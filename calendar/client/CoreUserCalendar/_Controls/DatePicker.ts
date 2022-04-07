// tslint:disable:no-magic-numbers
import {Control, IControlOptions, TemplateFunction} from 'UI/Base';
import {date as dateFormatter} from 'Types/formatter';
import {Object as WSEvent} from 'Env/Event';
import template = require('wml!CoreUserCalendar/_Controls/DatePicker');

interface IDatePickerOptions extends IControlOptions {
    pickerMode: string;
    startDate: Date;
    endDate: Date;
    range: number;
}

export default class DatePicker extends Control<IDatePickerOptions> {
    protected _template: TemplateFunction = template;
    protected _ranges: object;
    protected _weekCaptionFormatter: Function = (startDate: Date) => {
        return dateFormatter(startDate, dateFormatter.FULL_MONTH);
    }
    protected _liteCaptionFormatter: Function = (startDate: Date) => {
        return dateFormatter(startDate,
            (['month', 'timesheet'].includes(this._options.pickerMode)) ? 'MMMM\'YY' : 'YYYY');
    }

    protected _beforeMount(options: IDatePickerOptions): void {
        this._ranges = {
            days: [options.range]
        };
    }

    // если не обновлять endDate, то между режимами year/month не будет обновляться caption
    protected _beforeUpdate(options: IDatePickerOptions): void {
        this._ranges = {
            days: [options.range]
        };
    }

    protected _onRangeChanged(event: WSEvent, begin: Date, end: Date): void {
        this._notify('dateChanged', [begin], {bubbling: true});
    }
}
