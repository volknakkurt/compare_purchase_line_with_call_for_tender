# Copyright 2024 Akkurt Volkan
# License AGPL-3.0.

from odoo import _, api, Command, fields, models


class PurchaseRequisition(models.Model):
    _inherit = 'purchase.requisition'

    compare_po_line = fields.Boolean(related="type_id.compare_po_line", string="Compare PO Line")
    manufacturing_product = fields.Many2one('product.template', string="Manufacturing Product")
    product_bom = fields.Many2one('mrp.bom', string="Product BOM")
    use_brand_in_quotations = fields.Boolean(string="Use Brand", related="type_id.use_brand_in_quotations")

    # This function compares the purchase lines of all offers and selects the most appropriate one
    def compare_purchase_order_lines(self):
        self.ensure_one()
        purchase_order_lines = self.purchase_ids.order_line
        grouped_lines = {}

        for line in purchase_order_lines:
            product_id = line.product_id.id
            if product_id not in grouped_lines:
                grouped_lines[product_id] = []
            grouped_lines[product_id].append(line)

        for product_id, lines in grouped_lines.items():
            for line in lines:
                line.is_selected = False
                line.is_probably_selected = False
            ref_lines = lines
            cheapest_line = min(lines, key=lambda line: line.price_unit_compare)

            # TODO: add to if there have not date_end field
            if self.date_end:
                counter = 0
                while cheapest_line.date_planned > self.date_end:
                    counter += 1
                    if counter == 1:
                        for line in lines:
                            line.is_probably_selected = (line == cheapest_line)

                    ref_lines.remove(cheapest_line)
                    if not ref_lines:
                        break
                    cheapest_line = min(ref_lines, key=lambda line: line.price_unit_compare)

                for line in lines:
                    line.is_selected = (line == cheapest_line)
        self.check_requisition_lines(grouped_lines)

    # After comparing the purchase lines, if this function does not find a suitable supplier, it shows us this by coloring the tender.
    @api.model
    def check_requisition_lines(self, grouped_lines):
        for product_id, lines in grouped_lines.items():
            is_all_unselected = all(not line.is_selected for line in lines)
            if is_all_unselected:
                self.line_ids.search([('product_id', '=', product_id)]).is_check = False
            else:
                self.line_ids.search([('product_id', '=', product_id)]).is_check = True

    # These two functions bring the products in the recipes created based on the production for the tender to the tender
    @api.onchange('manufacturing_product')
    def _onchange_manufacturing_product(self):
        for rec in self:
            rec.product_bom = False
            if rec.manufacturing_product:
                product_bom_ids = self.env['mrp.bom'].search([('product_tmpl_id', '=', rec.manufacturing_product.id)])
                if len(product_bom_ids) == 1:
                    rec.product_bom = product_bom_ids[0]
            else:
                rec.product_bom = False

    @api.onchange('product_bom')
    def _onchange_product_bom(self):
        for rec in self:
            if rec.product_bom:
                product_bom_id = rec.product_bom

                order_lines_data = [fields.Command.clear()]
                order_lines_data += [
                    fields.Command.create({
                        'product_id': line.product_id.id,
                        'product_qty': 1.0,
                        'requisition_id': rec.id,
                        'price_unit': 0.0,
                    })
                    for line in product_bom_id.bom_line_ids
                ]
                rec.line_ids = order_lines_data
            else:
                order_lines_data = [fields.Command.clear()]
                rec.line_ids = order_lines_data


class PurchaseRequisitionLine(models.Model):
    _inherit = 'purchase.requisition.line'

    forecasted_issue = fields.Boolean(compute='_compute_forecasted_issue')
    is_check = fields.Boolean(string="Check", default=False)

    # The functions below give information about the stock status of the rows
    @api.depends('product_qty', 'schedule_date')
    def _compute_forecasted_issue(self):
        for purchase_req_line in self:
            warehouse = purchase_req_line.requisition_id.picking_type_id.warehouse_id
            purchase_req_line.forecasted_issue = False
            if purchase_req_line.product_id:
                virtual_available = purchase_req_line.product_id.with_context(warehouse=warehouse.id,
                                                                              to_date=purchase_req_line.schedule_date).virtual_available

                virtual_available += purchase_req_line.product_qty
                if virtual_available < 0:
                    purchase_req_line.forecasted_issue = True

    def action_product_forecast_report(self):
        self.ensure_one()
        action = self.product_id.action_product_forecast_report()
        action['context'] = {
            'active_id': self.product_id.id,
            'active_model': 'product.product',
        }
        warehouse = self.picking_type_id.warehouse_id
        if warehouse:
            action['context']['warehouse'] = warehouse.id
        return action
