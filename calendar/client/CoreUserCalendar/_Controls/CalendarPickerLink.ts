/**
 * кнопка-ссылка  открытия диалога редакирования списка подключенных календарей
 * ВАЖНО: присутствует только в разделе календарь и на стек-панели по шеврону,
 * - только рядом с основным календарем текущего польз-ля
 * Поэтому заргужает и следит за изменениями списка текущих календарей пользователя
 * ...и поставляет этот список в EventCalendarMonitor через Store
 * @class CoreUserCalendar.controls:CalendarPickerLink
 * @extends Control
 * @control
 * @public
 */

import { SyntheticEvent } from 'UICommon/Events';
import {Control, IControlOptions, TemplateFunction} from 'UI/Base';
import {DataSet, PrefetchProxy, Query, SbisService} from 'Types/source';
import {CalendarListModel, Helper} from 'CoreUserCalendar/common';
import {RecordSet} from 'Types/collection';
import Store from 'Controls/Store';
import {error as dataSourceError, parking} from 'Controls/dataSource';
import template = require('wml!CoreUserCalendar/_Controls/CalendarPickerLink');
import 'css!CoreUserCalendar/controls';
import rk = require('i18n!CoreUserCalendar');

interface IOptions extends IControlOptions {
    style: String;
    fontColorStyle: String;
    viewMode: String;
    canEdit?: Boolean;
}

enum calendarTypes {
    onlineWork,
    onlineCustom,
    onlineRoom,
    onlineVehicle,
    myPersonal = 10,
    myCustom = 11
}

export default class CalendarPickerLink extends Control<IOptions, RecordSet> {
    protected _template: TemplateFunction = template;
    protected _caption: String = '';
    protected _isClientAuth: boolean = Helper.isClientAuth() ;
    protected _errorViewConfig: parking.ViewConfig | void;
    private _tab: string;
    private _callbackId: string;
    private _listItems: RecordSet = null;
    private _errorController: dataSourceError.Controller = new dataSourceError.Controller({});
    private _sourceCfg: object = {
        endpoint: {
            contract: 'CalendarPermission'
        },
        keyProperty: '@CalendarPermission',
        model: CalendarListModel,
        orderProperty: 'Order',
        binding: {
            move: 'CalendarPermission.Move',
            query: 'Calendar.ListByPerson'
        }
    };
    private _listSource: SbisService = new SbisService(this._sourceCfg);
    private _calendarListFilter: Query = new Query();

    protected _beforeMount(options: IOptions, contxt?: object, receivedState?: RecordSet): Promise<RecordSet> | void {
        const CALENDAR_TYPES_MY_ALL = [calendarTypes.myCustom, calendarTypes.myPersonal];
        const CALENDAR_TYPES_ONLINE_ALL = [calendarTypes.onlineWork, calendarTypes.onlineCustom,
            calendarTypes.onlineRoom, calendarTypes.onlineVehicle];

        this._calendarListFilter.where({
            TypeCalendars: Helper.isMySbis() ? CALENDAR_TYPES_MY_ALL :
                [...CALENDAR_TYPES_ONLINE_ALL, ...CALENDAR_TYPES_MY_ALL]
        });
        if (options.prefetchResult && options.prefetchResult[0] && options.prefetchResult[0].get) {
            const prefetchRS = options.prefetchResult[0].get('calendar_list');
            this._tab = options.tab;
            const rs = new RecordSet({
                rawData: prefetchRS.getRawData(true),
                adapter: 'adapter.sbis',
                model: CalendarListModel
            });
            this._updateState(rs);
        } else {
            return this._listSource.query(this._calendarListFilter).then((calendarDataSet: DataSet) => {
                const calendarList = calendarDataSet.getAll();
                this._updateState(calendarList);
                return calendarList;
            }).catch((error: Error) => {
                this._errorHandler(error);
                return null;
            });
        }
    }

    protected _afterMount(options: IControlOptions): void {
        //
    }

    protected _beforeUpdate(options: IControlOptions): void {
        if (this._tab !== options.tab) {
            Store.dispatch('masterCalendarList', this._listItems);
        }
        this._tab = options.tab;
    }

    protected _beforeUnmount(): void {
        //
    }

    protected _loadData(): void {
        this._listSource.query(this._calendarListFilter).then((result) => {
            this._updateState(result.getAll());
        });
    }

    // EventCalendarMonitor -> listChanged -> _loadData -> Store -(masterCalendarList)-> EventCalendarMonitor
    // по событию от ECM обновляет список календарей и передает его обратно в ECM через Store
    private _updateState(calendarList: RecordSet): void {
        this._listItems = calendarList;
        Store.dispatch('masterCalendarList', this._listItems);
        this._updateCaption(this._listItems);
    }

    private _updateCaption(rs: RecordSet): void {
        const numberOfCalendars = rs.getIndicesByValue('Show', true).length;
        const firstIndex: number = this._listItems.getIndexByValue('Show', true);

        let caption = firstIndex > -1 ? rk(rs.at(firstIndex).get('Caption')) : rk('Календари');
        if ( numberOfCalendars > 1) {
            caption = caption + ' ' + rk('и ещё') + ' ' + (numberOfCalendars - 1);
        }
        this._caption = caption;
    }

    protected _onDialogClose(): void {
        if (this._listItems.isChanged()) {
            this._loadData();
        }
        // this._updateCaption(this._listItems); - надо делать в onResult, только если изменния сохраняются
    }

    protected _openCalendarPicker(): void {
        const calendarList = new PrefetchProxy({
            data: {
                query: this._listItems
            },
            target: new SbisService(this._sourceCfg)
        });
        this._children.sticky.open({
            template: 'CoreUserCalendar/widgets:CalendarPickerDialog',
            target: this,
            opener: this,
            offset: {
                vertical: -13
            },
            templateOptions: {
                canEdit: this._options.canEdit,
                dragNDrop: true,
                calendars: calendarList
            }
        });
    }

    protected _onResult(event: SyntheticEvent, data: Object): void {
        this._saveListChanges(data);
        this._updateCaption(this._listItems);
        this._children.sticky.close();
    }

    private _errorHandler(error: Error): Promise<unknown> {
        return this._errorController.process({
            error,
            mode: dataSourceError.Mode.dialog
        }).then((errorViewConfig) => {
            this._errorViewConfig = errorViewConfig;
            return error;
        });
    }

    private _saveListChanges(list: Object): void {
        new SbisService({
            endpoint: {
                address: '/service/',
                contract: 'Calendar'
            }
        }).call('SetShowEvents', {
            Params: list
        }).then(() => {
            // this._loadData(); - здесь обновлять данные не надо, чтбоы не было двойного запроса!
            // обновление будет по событию listChanged от EventCalendarMonitor
        }).catch((error: Error) => this._errorHandler(error));
    }
}
