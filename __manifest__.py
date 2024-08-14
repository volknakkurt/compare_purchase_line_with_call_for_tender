# Copyright 2024 Akkurt Volkan
# License AGPL-3.0.

{
    "name": "Compare Purchase Line With Call for Tender",
    "version": "17.0.1.0.1",
    "author": "Volkan",
    "category": "Inventory/Purchase",
    "license": "AGPL-3",
    "complexity": "normal",
    "depends": ["account", "purchase", "purchase_requisition", "product_brand_sale", "board"],
    "data": [
        'views/res_partner_views.xml',
        'views/purchase_order_views.xml',
        'views/product_requisition_views.xml',
        'views/purchase_requisition_type_views.xml',
    ],
    "assets": {
        "web.assets_backend": [
            'compare_purchase_line_with_call_for_tender/static/src/components/**/*.js',
            'compare_purchase_line_with_call_for_tender/static/src/components/**/*.scss',
            'compare_purchase_line_with_call_for_tender/static/src/components/**/*.xml',
        ],
    },
    "auto_install": False,
    "installable": True,
}
