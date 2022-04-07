import {DataSet, Memory, Query, SbisService} from 'Types/source';
import {Model} from 'Types/entity';
import {dateFromSql, dateToSql, TO_SQL_MODE} from 'Types/formatter';
import MonthModel, {ILegend, ILegends} from './MonthModel';
import {Helper, UserEventModel} from 'CoreUserCalendar/common';
import {cookie} from 'Env/Env';

const DEFAULT_HEIGHT = 1024;
const MONTH_HEADER_HEIGHT = 150;
const CELL_HEADER_HEIGHT = 22;
const MIN_CELL_HEIGHT = 85;
const EVENT_HEIGHT = 18;

interface IGetCalendarDataMonthParams {
    calendarUUID?: string;
    personID: number;
    employeeId?: number;
    utcOffset?: number;
    dateBegin: Date;
    dateEnd: Date;
    date?: Date;
}

interface IMonthListSourceParams {
    calendarUUID?: string;
    personID: number;
    utcOffset?: number;
    onDataLoad?: Function;
    eventsFilter?: string[];
    workspaceWidth: number;
}

interface IWhereData {
    Type: string;
    Flags: string[];
    Filter: Model;
}

export interface ICellRect {
    width: number;
    height: number;
}

function cellRect(month: Date, workspaceWidth: number): ICellRect {
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const firstDate = new Date(month.getFullYear(), month.getMonth());
    const firstDay = firstDate.getDay();
    const daysInAWeek = 7;
    const firstDayOffset = firstDay ? firstDay - 1 : 6; // Воскресенье 0-й день
    const weeksInMonth = Math.ceil((daysInMonth + firstDayOffset) / daysInAWeek);

    const s3ds = cookie.get('s3ds');
    const innerHeight = (typeof window !== 'undefined')
        ? window.innerHeight : s3ds ? Number(s3ds.split('|')[3]) : DEFAULT_HEIGHT;
    const monthHeight = innerHeight - MONTH_HEADER_HEIGHT;
    const cellHeight = Math.max(monthHeight / weeksInMonth, MIN_CELL_HEIGHT);

    const cellWidth = workspaceWidth / daysInAWeek;

    return {
        height: Math.ceil(cellHeight - CELL_HEADER_HEIGHT),
        width: cellWidth
    };
}

function _prepareModelDataToSource(monthEqual: boolean, items: object[]): DataSet {
    return new DataSet({
        rawData: {
            items,
            total: monthEqual ? { before: true, after: true } : true
        },
        itemsProperty: 'items',
        keyProperty: 'id'
    });
}

/**
 * Источник данных для сетки месяца календаря пользователя
 * @class MonthListSource
 * @extends Memory
 */
class MonthListSource extends Memory {
    private readonly _calendarUUID: string;
    private readonly _personID: number;
    private readonly _onDataLoad: Function;
    private _utcOffset: number;
    private _monthModels: MonthModel[] = [];
    private _legends: ILegends = {};
    private _monthDataFetching: Promise<object>[] = [];
    private _eventsFilter: string[];
    private _workspaceWidth: number;

    constructor(options: IMonthListSourceParams) {
        super();
        this._calendarUUID = options.calendarUUID;
        this._personID = options.personID;
        this._utcOffset = options.utcOffset;
        this._onDataLoad = options.onDataLoad;
        this._eventsFilter = options.eventsFilter;
        this._workspaceWidth = options.workspaceWidth;
    }

    query(query: Query): Promise<DataSet> {
        const offset = query.getOffset();
        const where = query.getWhere();
        const limit = query.getLimit() || 1;

        const promiseArray = [];
        const monthEqual = where['id~'];
        const monthGt = where['id>='];
        const monthLt = where['id<='];
        let month = monthEqual || monthGt || monthLt;

        if (month) {
            month = dateFromSql(month);
        } else {
            month = Helper.getFirstDayMonth(new Date());
        }

        month.setMonth(month.getMonth() + offset);

        if (monthLt) {
            month.setMonth(month.getMonth() - limit);
        } else if (monthGt) {
            month.setMonth(month.getMonth() + 1);
        }

        for (let i = 0; i < limit; i++) {
            const monthSql = dateToSql(month, TO_SQL_MODE.DATE);

            if (this._monthModels[monthSql]) {
                if (this._monthModels[monthSql].isEnriched()) {
                    promiseArray.push(this._monthModels[monthSql].getDaysData(this._eventsFilter,
                        cellRect(month, this._workspaceWidth)));
                    this._monthDataFetching[monthSql] = null;
                } else {
                    promiseArray.push(this._monthDataFetching[monthSql]);
                }
            } else {
                this._monthDataFetching[monthSql] = this.initMonthModel(month);
                promiseArray.push(this._monthDataFetching[monthSql]);
            }

            month.setMonth(month.getMonth() + 1);
        }

        return Promise.all(promiseArray).then((items) => _prepareModelDataToSource(monthEqual, items));
    }

    // TODO: сделать еще метод invalidatePeriod
    invalidateMonth(date: Date): void {
        this._monthModels[dateToSql(date, TO_SQL_MODE.DATE)] = null;
        this._legends[dateToSql(date, TO_SQL_MODE.DATE)] = null;
    }

    invalidateAll(): void {
        this._monthModels = [];
        this._legends = {};
    }

    setFilter(eventsFilter: string[]): void {
        this._eventsFilter = eventsFilter || [];
    }

    setUtcOffset(utcOffset: number): void {
        this._utcOffset = utcOffset;
    }

    _where(params: IGetCalendarDataMonthParams): IWhereData {
        const date = params.date;
        let dateBegin = params.dateBegin;
        let dateEnd = params.dateEnd;

        if (!dateBegin && !dateEnd && date instanceof Date) {
            dateBegin = date;
            dateEnd = Helper.getLastDayMonth(date);
        }
        if (!(dateBegin instanceof Date) || !(dateEnd instanceof Date)) {
            return null;
        }
        const dateYear = dateBegin.getFullYear();
        dateBegin = new Date(dateBegin.setFullYear(dateYear));
        dateEnd = new Date(dateEnd.setFullYear(dateYear));
        return {
            Type: 'month',
            Flags: ['events', 'plans'],
            Filter: Model.fromObject({
                calendarsUuid: params.calendarUUID,
                personId: params.personID,
                employee: params.employeeId || null,
                ShiftMinutes: params.utcOffset,
                dateStart: dateToSql(dateBegin, TO_SQL_MODE.DATE),
                dateStop: dateToSql(dateEnd, TO_SQL_MODE.DATE)
            }, 'adapter.sbis')
        };
    }

    getMonthModel(date: Date): MonthModel {
        let res: MonthModel = null;
        Object.keys(this._monthModels).forEach((dateStr) => {
            if (Helper.isEqualMonths(date, dateFromSql(dateStr))) {
                res = this._monthModels[dateStr];
            }
        });
        return res;
    }

    getMonthLegend(date: Date): ILegend | null {
        const model = this.getMonthModel(date);
        return model ? model.getLegend() : this._legends[dateToSql(date, TO_SQL_MODE.DATE)] || null;
    }

    setLegend(legends: ILegends): void {
        this._legends = legends || {};
    }

    initMonthModel(monthNumber: Date): Promise<object> {
        const month = new Date(monthNumber);
        const sqlMonthNumber = dateToSql(month, TO_SQL_MODE.DATE);
        const monthModelParams = { date: month, personId: this._personID };

        this._monthModels[sqlMonthNumber] = new MonthModel(monthModelParams);
        this._legends[sqlMonthNumber] = null;

        const request = new SbisService({
            endpoint: 'Calendar',
            model: UserEventModel
        });

        const where = this._where({
            calendarUUID: this._calendarUUID,
            personID: this._personID,
            utcOffset: this._utcOffset,
            dateBegin: Helper.getFirstDayMonth(month),
            dateEnd: Helper.getLastDayMonth(month)
        });

        return request.call('GetCalendarData', where).then((data) => {
            const dataRow = data.getRow();
            const eventsRow = dataRow.get('events');
            const plansRow = dataRow.get('plans');

            this._monthModels[sqlMonthNumber].updateWithData(eventsRow, plansRow && plansRow.get('schedule'));
            if (this._onDataLoad) {
                this._onDataLoad(dateFromSql(sqlMonthNumber), this._monthModels[sqlMonthNumber]);
            }

            return this._monthModels[sqlMonthNumber].getDaysData(this._eventsFilter,
                cellRect(month, this._workspaceWidth));
        });
    }
}

export default MonthListSource;
