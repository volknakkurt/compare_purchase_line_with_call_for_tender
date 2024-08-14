# Copyright 2024 Akkurt Volkan
# License AGPL-3.0.

from odoo import _, api, Command, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    brand_ids = fields.Many2many('product.brand', string='Brand')

