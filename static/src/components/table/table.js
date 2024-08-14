/** @odoo-module */

import { registry } from "@web/core/registry";
import { loadJS, loadCSS } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";

const { Component, onWillStart, useRef, onMounted, onPatched } = owl;

export class Table extends Component {
    setup() {
        this.tableRef = useRef("table");
        this.orm = useService("orm")
        this.onLineChanged = this.props.onLineChanged;
        onWillStart(async () => {
            await loadJS("https://unpkg.com/tabulator-tables@5.0.7/dist/js/tabulator.min.js");
            await loadCSS("https://unpkg.com/tabulator-tables@5.0.7/dist/css/tabulator.min.css");

            await this.getCompanyDetails()
            await this.formatCompanyDetails()
        });
        const style = document.createElement('style');
            style.innerHTML = `
                .tabulator .tabulator-header .tabulator-col {
                    background-color: #cf1336 !important;
                    color: white !important;
                }
            `;
            document.head.appendChild(style);
        onMounted(() => this.renderTable());

        onPatched(() => {
            this.renderTable();
            if (this.table) {
                this.table.replaceData(this.getCompanyDetails());
            }
        });
    }
    //Change boolean column in table
    async changeSelectedLine(company_id, product_id, is_selected){
        const requisition_active_id = this.props.active_id;
        const partner_id = parseInt(company_id, 10);

        const purchase_requisition = await this.orm.searchRead('purchase.requisition', [['id', '=', requisition_active_id]], ['id', 'purchase_ids']);
        const po_lines = await this.orm.searchRead('purchase.order.line', [['partner_id', '=', partner_id], ['product_id', '=', product_id], ['order_id', 'in', purchase_requisition[0].purchase_ids]], ['partner_id', 'id', 'order_id', 'name']);

        if (po_lines.length > 0) {
            const po_line_id = po_lines[0].id;
            await this.orm.write('purchase.order.line', [po_line_id], { is_selected: is_selected });
            await this.onLineChanged();
        }

    }
    //Grouping data by companies and products
    async getCompanyDetails() {
        const requisition_active_id = this.props.active_id;
        let domain = [['requisition_id', '=', requisition_active_id]];

        const orders = await this.orm.searchRead('purchase.order', domain, ['id', 'partner_id']);

        let groupedProducts = {};

        for (const order of orders) {
            const order_id = order.id;
            const company_id = order.partner_id[0];
            const company_name = order.partner_id[1];

            const lines = await this.orm.searchRead('purchase.order.line', [['order_id', '=', order_id]], ['product_id', 'price_unit', 'date_planned', 'is_selected', 'currency_id']);

            for (const line of lines) {
                const currency_symbol = await this.orm.searchRead('res.currency', [['id', '=', line.currency_id[0]]], ['id', 'symbol']);
                const product_id = line.product_id[0];

                if (!groupedProducts[product_id]) {
                    groupedProducts[product_id] = {
                        id: product_id,
                        product_name: line.product_id[1],
                    };
                }

                groupedProducts[product_id][`${company_id}_price`] = line.price_unit.toString() + currency_symbol[0].symbol;
                groupedProducts[product_id][`${company_id}_deadline`] = line.date_planned;
                groupedProducts[product_id][`${company_id}_is_selected`] = line.is_selected;
            }
        }
        return Object.values(groupedProducts);
    }
    //Data of table columns
    async formatCompanyDetails() {
        const companyDetails = await this.getCompanyDetails();

        var columns = [
            { title: "Product Name", field: "product_name", frozen: true }
        ];

        const companies = new Set();

        for (const detail of companyDetails) {
            for (const key in detail) {
                if (key.includes('_price') || key.includes('_deadline')) {
                    const companyId = key.split('_')[0];
                    companies.add(companyId);
                }
            }
        }
        const dataEditor = (cell, onRendered, success, cancel) => {
            const is_selected = cell.getValue() === true ? false : true;
            const company_id = cell.getField().split('_')[0];
            const product_id = cell.getRow().getData().id;

            this.changeSelectedLine(company_id, product_id, is_selected).then(() => {
                cell.setValue(is_selected);
                success(is_selected);
            }).catch((error) => {
                console.error(error);
                cancel();
            });
        };


        for (const companyId of companies) {
            const company = await this.orm.searchRead('res.partner', [['id', '=', companyId]], ['name']);

            let companyName = company[0].name;
            if (companyName.length > 20) {
                companyName = companyName.substring(0, 20) + '...';
            }

            columns.push({
                title: `${companyName}`,
                columns: [
                    { title: "Deadline", field: `${companyId}_deadline`, formatter: "datetime", hozAlign:"center", formatterParams: { outputFormat:"dd/MM/yy" } },
                    { title: "Price", field: `${companyId}_price`, hozAlign:"center" },
                    { title: "Suitable", field: `${companyId}_is_selected` , formatter: "tickCross", hozAlign:"center", editor:dataEditor },
                ]
            });
        }

        return columns;
    }
    //Table rendering
    async renderTable() {
        const table = new Tabulator(this.tableRef.el, {
            data: await this.getCompanyDetails(),
            columns: await this.formatCompanyDetails(),
            layout:"fitDataFill",
            movableRows:true,
            frozenRows:1,
            spreadsheet:true,
            spreadsheetOutputFull: true,
            maxHeight:"100%",
            rowHeight:100,
        });
        document.getElementById("download-xlsx").addEventListener("click", function(){
            table.download("xlsx", "data.xlsx", {sheetName:"My Data"});
        });
        this.table = table;
    }

}
Table.template = "owl.Table";
