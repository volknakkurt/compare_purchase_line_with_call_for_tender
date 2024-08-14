/** @odoo-module */

import { registry } from "@web/core/registry";
import { CompanyCard } from "./company_info_card/company_info_card";
import { Table } from "./table/table";
import { loadJS } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
const { Component, onWillStart, useRef, onMounted, useState, onPatched } = owl

export class ProductCompareComponents extends Component {
    setup() {
        const active_id = this.props.action.context.active_id;
        this.onLineChanged = this.onLineChanged.bind(this);
        this.state = useState({
            cardData: []
        })
        this.orm = useService("orm")
        this.actionService = useService("action")
        onWillStart(async () => {
            await loadJS("https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.18.1/moment.min.js")
            await loadJS("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js")
            const cardData = await this.getCompanyQuotations();
            this.state.cardData = Object.values(cardData);
        });
        onMounted(async () => this.getCompanyQuotations());

        onPatched(async () => {
            if (this.state.cardData) {
                Object.values(await this.getCompanyQuotations());
            }
        });
    }
    //Collects data required for the board in the component
    async getCompanyQuotations() {
        const requisition_active_id = this.props.action.context.active_id;
        let domain = [['requisition_id', '=', requisition_active_id]];

        const orders = await this.orm.searchRead('purchase.order', domain, ['id', 'partner_id', 'amount_total', 'currency_id', 'date_planned', 'order_line', 'requisition_id']);
        const groupedOrders = orders.reduce((acc, order) => {
            if (!acc[order.partner_id[0]]) {
                acc[order.partner_id[0]] = {
                    partner_id: order.partner_id,
                    partner_name: null,
                    total_amount: 0,
                    requisition_id: order.requisition_id[0],
                    order_id: order.id,
                    order_line: order.order_line,
                    line_count: 0,
                    currency_id: order.currency_id,
                    date_planned: order.date_planned,
                };
            }
            let companyName = order.partner_id[1];
            if (companyName.length > 20) {
                companyName = companyName.substring(0, 27) + '...';
            }
            acc[order.partner_id[0]].partner_name = companyName;
            acc[order.partner_id[0]].total_amount = order.amount_total;
            return acc;
        }, {});
        for (const order of orders){
            const partner_id = groupedOrders[order.partner_id[0]].partner_id[0]
            const order_line_ids = groupedOrders[order.partner_id[0]].order_line
            const lineDomain = [['id', 'in', order_line_ids], ['is_selected', '=', true]];
            const selectedLines = await this.orm.searchRead('purchase.order.line', lineDomain, ['id']);

            const order_currency_symbol = await this.orm.searchRead('res.currency', [['id', '=', order.currency_id[0]]], ['symbol']);
            groupedOrders[order.partner_id[0]].amount_total_currency = order_currency_symbol[0].symbol;

            if (order.order_line == groupedOrders[order.partner_id[0]].order_line){
                groupedOrders[order.partner_id[0]].line_count = selectedLines.length;
            }
        }
        const requisition = await this.orm.read('purchase.requisition', [requisition_active_id], ['currency_id']);
        const requisition_currency_id = requisition[0].currency_id[0];

        for (const partner_id in groupedOrders) {
            const orderCurrencyId = groupedOrders[partner_id].currency_id[0];

            const req_currency_symbol = await this.orm.searchRead('res.currency', [['id', '=', requisition_currency_id]], ['symbol']);
            groupedOrders[partner_id].total_amount_converted_currency = req_currency_symbol[0].symbol;
            if (requisition_currency_id !== orderCurrencyId) {
                const amountToConvert = groupedOrders[partner_id].total_amount;
                const convertedAmount = await this.convertCurrency(orderCurrencyId, amountToConvert, requisition_currency_id, groupedOrders[partner_id].date_planned);
                groupedOrders[partner_id].total_amount_converted = convertedAmount;
            } else {
                groupedOrders[partner_id].total_amount_converted = groupedOrders[partner_id].total_amount;
            }
        }
        return groupedOrders;
    }
    //Function that changes the exchange rate
    async convertCurrency(from_currency_id, amount_total, to_currency_id, date_planned) {
        const conversionRate = await this.orm.call('purchase.order', 'get_convert_for_table_card', [from_currency_id, amount_total, to_currency_id, date_planned]);
        return conversionRate;
    }
    //Function that opens the relevant offer when clicked in the snow
    async onCardClick(order) {

        this.actionService.doAction({
            type: "ir.actions.act_window",
            name: "Quotations",
            res_model: "purchase.order",
            res_id: order.id,
            view_mode: "form",
            target: "new",
            views: [
                [false, "form"]
                ]
        })
    }
    //To update the card when data changes in the table
    onLineChanged = async () => {
        try {
            const cardData = await this.getCompanyQuotations();
            this.state.cardData = Object.values(cardData);
        } catch (error) {
        }
    }
}
ProductCompareComponents.template = "owl.ProductCompareComponents"
ProductCompareComponents.components = { CompanyCard, Table }

registry.category("actions").add("owl.action_table_board", ProductCompareComponents);