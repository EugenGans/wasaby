import { SyntheticEvent } from 'UI/Vdom';
import {Control, IControlOptions, TemplateFunction} from 'UI/Base';
import {dictionary} from 'CoreUserCalendar/common';
import 'css!CoreUserCalendar/year';
import template = require('wml!CoreUserCalendar/_Controls/StatsBar');

interface IStatsItem {
    name: string;
    count: number;
    icon: string;
    colorClass: string;
}

interface ILegendItem {
    count: number;
    duration: number;
}

interface IStatsBarOptions extends IControlOptions {
    stats: Record<string, ILegendItem>;
    date: Date;
}

const ALLOWED_TYPES = [
    'Командировка',
    'Отпуск',
    'Больничный',
    'Прогул',
    'Простой',
    'Отгул'
];

/**
 * Компонент статистики событий за год
 */
export default class StatsBar extends Control<IStatsBarOptions> {
    protected _template: TemplateFunction = template;
    protected _items: IStatsItem[] = [];
    protected _expandedCaptionItem: number;

    // region Lifecycle hooks

    protected _beforeMount(options: IStatsBarOptions,
                           context: unknown,
                           receivedState: Record<string, ILegendItem>): void | Promise<Record<string, ILegendItem>> {
        // TODO afterMOunt
        this._updateState(options);
    }

    protected _afterMount(options: IStatsBarOptions): void {
        // TODO afterMount
    }

    protected _beforeUnmount(): void {
        // TODO remove subscriptions
    }

    protected _beforeUpdate(options: IStatsBarOptions): void {
        if (options.stats !== this._options.stats) {
            this._updateState(options);
        }
    }

    protected _afterUpdate(oldOptions?: IStatsBarOptions): void {
        // TODO afterUpdate
    }

    private _updateState(options: IStatsBarOptions): void {
        const newItems = [];
        for (const item in options.stats) {
            if (ALLOWED_TYPES.includes(item)) {
                newItems.push({
                    name: item,
                    count: options.stats[item].count,
                    icon: dictionary.DOC_ICONS[item],
                    colorClass: dictionary.FULLDAY_EVENTS_TYPES[item]
                });
            }
        }
        this._items = newItems;
    }

    protected _toggleCaption(e: SyntheticEvent<MouseEvent>, index: number): void {
        this._expandedCaptionItem = this._expandedCaptionItem === index ? undefined : index;
    }

}
