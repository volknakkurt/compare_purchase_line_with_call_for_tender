# Copyright 2024 Akkurt Volkan
# License AGPL-3.0.

from odoo import _, api, Command, fields, models, http
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class PurchaseOrder(models.Model):
    _inherit = 'purchase.order'

    # When approving the purchase offer, this button ets the product_qty of non is_selected lines equal to zero
    # and those lines do not appear on delivery.
    def button_confirm(self):
        for order in self:
            if order.state not in ['draft', 'sent']:
                continue
            order.order_line._validate_analytic_distribution()
            order._add_supplier_to_product()

            for line in order.order_line:
                if not line.is_selected:
                    line.product_qty = 0

            # Deal with double validation process
            if order._approval_allowed():
                order.button_approve()
            else:
                order.write({'state': 'to approve'})
            if order.partner_id not in order.message_partner_ids:
                order.message_subscribe([order.partner_id.id])
        return True

    # This function performs currency conversion for us with the given parameters and is used in the CompanyCard component
    # within the ProductCompareTables.
    @api.model
    def get_convert_for_table_card(self, from_currency_id, amount_total, to_currency_id, date_planned):
        to_currency = self.env['res.currency'].search([('id', '=', to_currency_id)], limit=1)
        from_currency = self.env['res.currency'].search([('id', '=', from_currency_id)], limit=1)
        converted_amount = from_currency._convert(
            amount_total,
            to_currency,
            self.env.company,
            date_planned
        )
        return converted_amount

    # This function removes products from the rows except for those whose brand matches the entered brand,
    # if specified, in the purchase order.
    def delete_purchase_order_line_by_brand(self):
        if self.partner_id.brand_ids:
            for po_line in self.order_line:
                if po_line.product_id.brand_id:
                    if po_line.product_id.brand_id not in self.partner_id.brand_ids:
                        po_line.unlink()
                        _logger.info('sıkıntı yok')
        else:
            raise UserError(_("The relevant partner does not have a brand!"))


class PurchaseOrderLine(models.Model):
    _inherit = 'purchase.order.line'

    is_selected = fields.Boolean(default=False)

