# Copyright 2024 Akkurt Volkan
# License AGPL-3.0.

from odoo import _, api, Command, fields, models


class PurchaseRequisitionType(models.Model):
    _inherit = 'purchase.requisition.type'

    compare_po_line = fields.Boolean(string="Compare PO Line", default=True)
    use_brand_in_quotations = fields.Boolean(string="Use Brand", default=True)
