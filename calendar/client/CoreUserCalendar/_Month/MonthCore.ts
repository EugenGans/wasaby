import {Control, IControlOptions, TemplateFunction} from 'UI/Base';
import {Helper} from 'CoreUserCalendar/common';
import MonthSource from './MonthSource';
import {IDayEvent, ILegend, ILegends} from './MonthModel';
import {Info} from 'EngineUser/Info';
import { SyntheticEvent } from 'UICommon/Events';
import {Bus} from 'Env/Event';
import * as dragnDrop from 'Controls/dragnDrop';
import {MonthList} from 'Controls/calendar';
import {Confirmation} from 'Controls/popup';
import {Record as WSRecord} from 'Types/entity';
import {date as dateFormatter, dateFromSql, dateToSql, TO_SQL_MODE} from 'Types/formatter';
import 'css!CoreUserCalendar/month';
import {DataSet, SbisService} from 'Types/source';
import {error as dataSourceError, parking} from 'Controls/dataSource';
import {Utils} from 'Controls/dateRange';
import rk = require('i18n!CoreUserCalendar');
import wmlMonthCore = require('wml!CoreUserCalendar/_Month/MonthCore');
import {Base as dateUtils} from 'Controls/dateUtils';
import {detection} from 'Env/Env';

interface IOptions extends IControlOptions {
    active?: boolean;
    calendarUUID?: string;
    personID?: number;
    employeeID?: number;
    utcOffset?: number;
    date?: Date;
    eventsFilter?: string[];
    updateLegend: Function;
    workspaceWidth: number;
}

const DND_HINT_ELEMENT_CLASS = '.wtm-CalendarMonth__day_dnd-hint';
const DND_HINT_TEXT_ATTRIBUTE = 'data-drag-type';

/**
 * Компонент сетки месяца календаря пользователя
 * @class MonthCore
 * @extends Control
 */
export default class MonthCore extends Control<IOptions, ILegends> {
    protected _template: TemplateFunction = wmlMonthCore;
    protected _displayedMonth: Date = Helper.getFirstDayMonth(new Date());
    protected _monthSource: MonthSource;
    protected _moreButtonCounter: Record<string, number> = {};
    protected _highlightDocumentId: number = null;
    protected _weekDays: string[] = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    protected _options: IOptions;
    private _monthsToUpdate: Date[];
    private _currentLegend: object;
    private _updatePeriodBound: Function;
    private _resizeHandlerBound: () => void;
    private _ctrlKeyHoldHandler: (keyHoldEvent: KeyboardEvent) => void;
    private _copyKeyName: string = detection.isMac ? 'metaKey' : 'ctrlKey';
    private _isMounted: boolean = false;
    protected _errorViewConfig: parking.ViewConfig;
    private _errorController: dataSourceError.Controller = new dataSourceError.Controller({});
    protected _children: {
        dragContainer: dragnDrop.Container;
    };

    protected _beforeMount(options: IOptions, context: unknown, receivedState: ILegends): Promise<ILegends> {
        const savedLegends: ILegends = {};
        this._monthSource = new MonthSource({
            utcOffset: options.utcOffset,
            calendarUUID: options.calendarUUID,
            personID: options.personID,
            eventsFilter: options.eventsFilter || [],
            workspaceWidth: options.workspaceWidth,
            onDataLoad: (date, model) => {
                const legend = model.getLegend();
                if (Helper.isEqualMonths(date, this._displayedMonth) && this._isMounted) {
                    options.updateLegend(null, this._getLegend());
                } else if (!this._isMounted) {
                    savedLegends[dateToSql(date, TO_SQL_MODE.DATE)] = legend;
                    options.updateLegend(null, legend);
                }
            }
        });
        this._updatePeriodBound = Helper.createUpdater(this._updatePeriod.bind(this));
        this._displayedMonth = Helper.getFirstDayMonth(options.date);
        this._resizeHandlerBound = this._resizeHandler.bind(this);

        if (receivedState) {
            this._monthSource.setLegend(receivedState);
        } else {
            return new Promise<ILegends>((resolve) => {
                resolve(savedLegends);
            });
        }
        window.addEventListener('resize', this._resizeHandlerBound);
    }

    protected _afterMount(): void {
        Bus.serverChannel('calendar.update.mass').subscribe('onMessage', this._updatePeriodBound);
        Bus.serverChannel('calendar.update').subscribe('onMessage', this._updatePeriodBound);
        this._isMounted = true;
        this._updateLegend();
        this._ctrlKeyHoldHandler = (keyHoldEvent: KeyboardEvent) => {
            const hintText = keyHoldEvent[this._copyKeyName] ? 'Копировать' : 'Переместить';
            const hintElement = document.querySelector(DND_HINT_ELEMENT_CLASS);

            /*
                Событие keydown будет спамить пока кнопка удерживается, если не проверять наличие элемента
                может произойти ошибка: подписка создалась, а элемент еще не создан.
                Шаблон драга лежит внутри прямого потомка body
             */
            if (hintElement) {
                hintElement.setAttribute(DND_HINT_TEXT_ATTRIBUTE, rk(hintText));
            }
        };
    }

    protected _beforeUnmount(): void {
        Bus.serverChannel('calendar.update.mass').unsubscribe('onMessage', this._updatePeriodBound);
        Bus.serverChannel('calendar.update').unsubscribe('onMessage', this._updatePeriodBound);
        window.removeEventListener('resize', this._resizeHandlerBound);
        this._updatePeriodBound = null;
        this._resizeHandlerBound = null;
    }

    protected _beforeUpdate(options?: IOptions): void {

        // Обновление даты во время скролла вызывает beforeUpdate.
        // Если при этом записать первый день переданного месяца, осуществится подскрол до начала месяца
        if (!Helper.isEqualMonths(this._displayedMonth, options.date)
            && !Helper.isEqualMonths(this._options.date, options.date)) {
            this._displayedMonth = Helper.getFirstDayMonth(options.date);
        }

        if (this._options.eventsFilter !== options.eventsFilter) {
            this._monthSource.setFilter(options.eventsFilter);
            const monthListElement = this._children.MonthList as MonthList;
            monthListElement.invalidatePeriod(-Infinity, Infinity);
        }

        if (this._options.utcOffset !== options.utcOffset) {
            this._monthSource.setUtcOffset(options.utcOffset);
            this._updateMonth();
        }

        if (options.active && this._monthsToUpdate) {
            this._invalidateMonth(this._monthsToUpdate);
            this._monthsToUpdate = null;
        }
    }

    protected _afterUpdate(oldOptions?: IOptions): void {
        if (this._options.active) {
            if (this._monthSource.getMonthModel(this._displayedMonth)?.isEnriched()) {
                this._updateLegend();
            }
        } else {
            this._currentLegend = null;
        }
    }

    protected _updateLegend(legend?: object): void {
        const newLegend = legend || this._getLegend();
        if (newLegend !== this._currentLegend) {
            this._currentLegend = newLegend;
            this._options.updateLegend(null, this._getLegend());
        }
    }

    protected _updatePeriod(dataList: WSRecord[]): void {
        function fillMonths(dateBegin: Date, dateEnd: Date): void {
            const curDate = Helper.getFirstDayMonth(dateBegin);
            months[dateFormatter(curDate, 'YYYY-MM-DD')] = true;
            while (!Helper.isEqualMonths(curDate, dateEnd)) {
                curDate.setMonth(curDate.getMonth() + 1);
                months[dateFormatter(curDate, 'YYYY-MM-DD')] = true;
            }
        }

        const months = {};
        dataList.forEach((data) => {
            const dates = data.get('dates') || [];
            const dateBegin = data.get('period_begin');
            const dateEnd = data.get('period_end');

            if (dateBegin && dateEnd) {
                fillMonths(dateBegin, dateEnd);
            }

            /*
            * https://online.sbis.ru/opendoc.html?guid=755a2526-7f8a-40ff-822b-e76c3422ed81
            * После внедрения событий на несколько дней.
            * Когда с БЛ в поле dates приходят даты, необходимо обновлять от самой ранней до самой поздней.
            * Согласовано с разработчиками БЛ.
            *
            * Важно! Мы не можем проверить и обновить только текущий и следующий месяц. Если
            * игнорировать остальные месяца, то не будут обновляться отрисованные месяца в DOM
            * для которых уже сформировался кеш. Логика обновления видимых месяцов есть в MonthList
            * */
            if (dates.length > 1) {
                const sortedDates = dates.sort((date1: Date, date2: Date) => {
                    return date1.getTime() - date2.getTime();
                });
                fillMonths(sortedDates[0], sortedDates[sortedDates.length - 1]);
            } else if (dates.length === 1) {
                months[dateFormatter(dates[0], 'YYYY-MM') + '-01'] = true;
            }
        });
        this._updateMonth(Object.keys(months)
                        .map((sqlString: string) => dateFromSql(sqlString))
                        .sort((date1: Date, date2: Date) => {
                            return date1.getTime() - date2.getTime();
                        }));
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

    protected _onHeaderClick(event: SyntheticEvent<MouseEvent>, date: Date): void {
        const target = event.target;
        const leftBorder = 3;
        const rightBorder = 24;

        if (event.nativeEvent.offsetX >= leftBorder && event.nativeEvent.offsetX <= rightBorder) {
            this._onDateClick(event, date);
        } else if (Helper.coreConstantsChecker()) {
            this._notify('openDayInfo', [{date}, target], {bubbling: true});
        } else {
            this._notify('createNewEvent', [{
                date,
                calcStartTime: true,
                target
            }], {bubbling: true});
        }

        event.stopPropagation();
    }

    protected _onDateClick(event: SyntheticEvent<MouseEvent>, date: Date): void {
        this._notify('modeChanged', ['days', date], {bubbling: true});
        event.stopPropagation();
    }

    protected _onContentClick(event: SyntheticEvent<MouseEvent>, date: Date): void {
        const headerHeight = 22;
        if (event.nativeEvent.offsetY <= headerHeight) {
            this._onHeaderClick(event, date);
        } else {
            const target = event.target;
            this._notify('createNewEvent', [{
                date,
                calcStartTime: true,
                target
            }], {bubbling: true});
        }
        event.stopPropagation();
    }

    protected _onEventClick(event: SyntheticEvent<MouseEvent>, eventObject: WSRecord): void {
        this._notify('openEventCard', [eventObject, event.target], {bubbling: true});
        event.stopPropagation();
    }

    protected _onEventMouseDown(event: SyntheticEvent<MouseEvent>, eventElement: IDayEvent): void {
        if (event.currentTarget.classList.contains('controls-DragNDrop__notDraggable') ||
            eventElement.get('Документ') === -1) {
            return;
        }

        const dragContainer = this._children.dragContainer;
        const text = eventElement.get('text');
        const regulationName = eventElement.get('regulation_name');
        const description = eventElement.get('description');
        const fullText = (description ? description + ' ' : '') +
            (regulationName ? regulationName + ' ' : '') +
            (text ? text + ' ' : '');
        let classes: string = eventElement.get('eventColorClass');
        if (event.target.offsetHeight >= 18) {
            classes = classes + ' wtm-CalendarMonth__day_dnd-hint_doubleLine';
        }

        dragContainer.startDragNDrop(new dragnDrop.ItemEntity({
            item: eventElement.clone(),
            classes,
            width: getComputedStyle(event.currentTarget).width,
            startTime: eventElement.get('dateStartShort'),
            text: fullText
        }), event);

        window.addEventListener('keydown', this._ctrlKeyHoldHandler);
        window.addEventListener('keyup', this._ctrlKeyHoldHandler);
    }

    protected _dragEnd(event: SyntheticEvent<unknown>,
                       dragElement: dragnDrop.ItemEntity): void {
        window.removeEventListener('keydown', this._ctrlKeyHoldHandler);
        window.removeEventListener('keyup', this._ctrlKeyHoldHandler);

        if (!dragElement) {
            return null;
        }

        const draggableItem: WSRecord = dragElement.entity.getItem();
        const copyKey = dragElement.domEvent[this._copyKeyName];

        // Если работа проверена то она либо true либо false и её менять нельзя
        if (!draggableItem.get('can_edit') ||
            (draggableItem.get('isNorm') && draggableItem.get('isDone') !== null && !copyKey)) {
            const popupOptions = {
                type: 'ok',
                style: 'danger',
                message: draggableItem.get('Флаги').get('Выполнено') !== null ?
                    rk('Нельзя изменять зачтенную работу.') : rk('Данное событие нельзя изменить.')
            };
            Confirmation.openPopup(popupOptions);
            return;
        }

        const dayCell = dragElement.domEvent.target.closest('.wtm-CalendarMonth__day');
        const dropDate = dayCell && new Date(dayCell.dataset.date);

        if (dropDate && dateUtils.isValidDate(dropDate) && !Helper.isEqualDays(draggableItem.get('Дата'), dropDate)) {
            const MS_PER_DAY = 86400000;
            const dragDaysOffset = (dropDate.getTime() - draggableItem.get('Дата').getTime()) / MS_PER_DAY;
            const startDate = draggableItem.get('ДатаНачала');
            const finishDate = draggableItem.get('ДатаОкончания');

            // В событии до полуночи дата окончания - следующий день 0:00.
            // Дополнительная проверка для таких событий
            const newStartDate = new Date(startDate.getTime());
            newStartDate.setDate(newStartDate.getDate() + dragDaysOffset);
            const newFinishDate = new Date(finishDate.getTime());
            newFinishDate.setDate(newFinishDate.getDate() + dragDaysOffset);
            draggableItem.set({
                ДатаНачала: newStartDate,
                ДатаОкончания: newFinishDate
            });

            if (copyKey) {
                draggableItem.set({
                    ExtId: null,
                    '@Работа': null
                });
                draggableItem.get('Флаги').set('Выполнено', null);
            }

            this._updater(draggableItem).catch((error: Error) => this._errorHandler(error));
        }
    }

    protected _monthWeekHeight(date: Date): number {
        const monthHeight = 100;
        return monthHeight / Utils.getWeeksInMonth(date.getMonth(), date.getFullYear());
    }

    protected _onDocumentTitleMouseOver(event: SyntheticEvent<unknown>, workId: number): void {
        this._highlightDocumentId = workId;
    }

    protected _onDocumentTitleMouseOut(): void {
        this._highlightDocumentId = null;
    }

    protected _onDocumentClick(event: SyntheticEvent<MouseEvent>, eventRecord: WSRecord): void {
        this._notify('openDocument', [eventRecord, event.target], {bubbling: true});
        event.stopPropagation();
    }

    protected _moreClick(event: SyntheticEvent<MouseEvent>, date: Date): void {
        event.stopPropagation();

        const personID = this._options.personID;
        const isMySbis = Helper.isMySbis();
        const isMyCalendar = Info.get('ЧастноеЛицо') === personID || isMySbis;

        import('CoreUserCalendar/base').then((Base) => {
            Base.Stack.open({
                date: new Date(date),
                personID,
                onlyMain: !isMyCalendar,
                mini: true,
                isStack: true,
                caption: isMyCalendar && !isMySbis ? '' : 'Календарь',
                calendarsInCaption: isMyCalendar && !isMySbis,
                draw: {
                    buttonOptions: false,
                    plusButton: !isMySbis,
                    legend: false,
                    tasksCount: true,
                    timezone: true,
                    activityRow: true
                },
                eventsFilter: this._options.eventsFilter,
                utcOffset: this._options.utcOffset,
                periodDayCount: 1,
                showWeekend: true,
                tabs: ['days']
            });
        });
    }

    // Также используется при клике в заголовок дня
    protected _monthPositionChangedHandler(event: SyntheticEvent<unknown>, date: Date): void {
        /*
         * FIXME неактивная вкладка месяца итеративно изменяет дату до той, на которую указывает сетка.
         * Решение блока. Вероятно, должно решаться на уровне компонента MonthList.
         */
        if (!this._options.active) {
            return;
        }
        // Внимание! Опасность! Опасность!
        // Дату, которая приходит от MonthList НЕЛЬЗЯ менять.
        // Она должна быть ровно та же (по ссылке!) что и пришла. Иначе это приведет к дерганиям при скролле
        this._displayedMonth = date;
        this._notify('dateChanged', [date], {bubbling: true});
    }

    protected _monthTitleFormatter(date: Date): string {
        return date ? dateFormatter(date, dateFormatter.FULL_MONTH) : '';
    }

    private _getLegend(): ILegend {
        return this._monthSource ? this._monthSource.getMonthLegend(this._displayedMonth) : {};
    }

    /**
     * Функция обновляет событие на БЛ
     * @param {Record<IEventUpdaterData>} eventObject
     * @param {object} updatedData
     * @returns {Promise<DataSet>}
     */
    private _updater(eventObject: WSRecord): Promise<DataSet> {
        return new SbisService({
            endpoint: 'EventAggregator'
        }).call('UpdateEvent', {
            event_source: eventObject.get('event_source'),
            data: eventObject
        });
    }

    private _updateMonth(months?: Date[]): void {
        if (!this._options.active) {
            this._monthsToUpdate = months;
        } else {
            this._invalidateMonth(months);
        }
    }

    private _invalidateMonth(months?: Date[]): void {
        const monthListElement = this._children.MonthList as MonthList;
        if (months && months.length > 0) {
            // синхронно очистим модель из кеша
            months.forEach((month) => this._monthSource.invalidateMonth(month));
            monthListElement.invalidatePeriod(months[0], months[months.length - 1]);
        } else {
            // Включение/Отключение календаря, смена часового пояса
            this._monthSource.invalidateAll(); // или все модели
            monthListElement.invalidatePeriod(-Infinity, Infinity);
        }
    }

    private _resizeHandler(): void {
        const monthListElement = this._children.MonthList as MonthList;
        monthListElement.invalidatePeriod(-Infinity, Infinity);
    }
}
