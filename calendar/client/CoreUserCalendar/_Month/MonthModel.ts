import {Model} from 'Types/entity';
import {RecordSet} from 'Types/collection';
import {Helper, UserEventModel} from 'CoreUserCalendar/common';
import {dateToSql, TO_SQL_MODE} from 'Types/formatter';
import {ICellRect} from 'CoreUserCalendar/_Month/MonthSource';
import { constants } from 'Env/Env';

enum MONTH_EVENTS {
    Больничный = 'hospital',
    Командировка = 'trip',
    'Плановый отпуск:1' = 'planVacation1',
    'Плановый отпуск:2' = 'planVacation2', // На удалении
    'Плановый отпуск:3' = 'planVacation3', // На согласовании
    Отпуск = 'vacation',
    Отгул = 'leave',
    Прогул = 'absence',
    Простой = 'stay'
}

// для css: 1/7 в процентах
const DAY_CELL_RELATIVE_WIDTH = 14.28;
const MARKER_EVENTS = ['Отгул', 'Прогул', 'Простой'];

interface IModelState {
    date?: Date;
    dateBegin?: Date;
    dateEnd?: Date;
    personId?: number;
    employeeId?: number;
}

type IDayEvents = RecordSet<UserEventModel>;

interface IDayItem {
    eventBlocksCount?: number;
    isFestDay: boolean;
    dayScheduleType: string;
    markerEventType: MONTH_EVENTS;
    fullDayEvent?: MONTH_EVENTS;
    fullDayEventLength?: number;
    fullDayEventStackWidth?: number;
    fullDayEventStacktitleShift?: number;
    fullDayWorkId?: number;
    isShowFullDayEventDuration?: boolean;
    dayEvents: IDayEvents;
    moreButtonCounter: number;
}

interface ILegendItem {
    count: number;
    duration: number;
}

export type ILegend = Partial<Record<string, ILegendItem>>;
export type ILegends = Record<string, ILegend>;
/**
 * Модель данных для сетки месяца календаря пользователя
 * @class MonthModel
 * @extends Control
 */
class MonthModel {
    private _daysArray: IDayItem[] = [];
    private _state: IModelState;
    private _legend: ILegend;
    protected _version: number = 0;

    constructor(state?: object) {
        this._state = this._normalizeState(state);
    }

    private _normalizeState(state: IModelState = {}): IModelState {
        return {
            dateBegin: state.date ? Helper.getFirstDayMonth(state.date) : null,
            dateEnd: state.date ? Helper.getLastDayMonth(state.date) : null,
            personId: state.personId || null,
            employeeId: state.employeeId || null
        };
    }

    private _createEmptyDayDataItem(): IDayItem {
        return {
            dayScheduleType: '',
            isFestDay: false,
            fullDayEvent: null,
            markerEventType: null,
            fullDayWorkId: null,
            isShowFullDayEventDuration: false,
            dayEvents: null
        };
    }

    private _resetDayElement(index: number): void {
        this._daysArray[index] = this._createEmptyDayDataItem();
    }

    getLegend(): ILegend {
        return this._legend;
    }

    isEnriched(): boolean {
        return this._daysArray && this._daysArray.length > 0;
    }

    // асинхронное потому что должно быть того же типа, что и запрос данных на сервер
    getDaysData(eventsFilter: string[] = [], cellRect?: ICellRect): Promise<{id: string, extData: IDayItem[]}> {
        const fullDayEventsMap = {};
        const firstDayMonth = this._state.dateBegin;
        const filteredDays = this._daysArray.map((data: IDayItem, index: number) => {
            let fullDayDocId = null;
            let markerEventType = null;
            const newDayData: IDayItem = {...data};
            let fullDayEventType = null;
            let fullDayEventPriority: number = -Infinity;
            let fullDayEventIndex: number = null;

            const visibleEvents = new RecordSet({
                rawData: null,
                adapter: data.dayEvents.getAdapter(),
                model: UserEventModel
            });

            let eventsStackHeight: number = 0;
            let cellIsFull: boolean = false;
            newDayData.moreButtonCounter = 0;

            data.dayEvents.each(( event: UserEventModel): void => {
                let eventAdded: boolean = false;

                // Перебираем события, включаем только те, что активированы в легенде
                if (!eventsFilter.includes(event.get('typeDoc'))) {
                    // Событие на часы.
                    // Если оно автоматически созданное - надо проверить
                    // не кандидат ли это на то, что бы покрасить шапку
                    if (!event.get('isFullDayEvent')) {
                        if (!markerEventType && event.get('СозданаАвтоматически')) {
                            const docType = event.get('typeDoc');
                            if (MARKER_EVENTS.includes(docType)) {
                                markerEventType = docType;
                            }
                        }
                        if (!cellIsFull) {
                            visibleEvents.add(event);
                            eventAdded = true;
                        } else {
                            newDayData.moreButtonCounter++;
                        }
                    } else if (!fullDayEventType || fullDayEventPriority < event.get('dayPriority')) {
                        // ищем самое приоритетное событие на весь день и оставляем только его
                        if (fullDayEventIndex === null) {
                            visibleEvents.add(event, 0);
                            eventAdded = true;
                            if (cellIsFull) {
                                newDayData.moreButtonCounter++;
                            }
                            fullDayEventIndex = 0;
                        } else {
                            visibleEvents.replace(event, fullDayEventIndex);
                        }

                        fullDayEventPriority = event.get('dayPriority');
                        fullDayEventType = event.get('fullDayEventType');
                        fullDayDocId = event.get('workId');
                    }
                    if (eventAdded) {
                        // считаем, влезают ли события визуально
                        const currentEventHeight = this.eventHeight(event, cellRect);
                        eventsStackHeight += currentEventHeight;
                        const eventMinVisibleHeight = 10;
                        if (eventsStackHeight > cellRect.height) {
                            cellIsFull = true;
                            newDayData.moreButtonCounter += cellRect.height - (eventsStackHeight - currentEventHeight)
                            < eventMinVisibleHeight ? 1 : 0;
                        }
                    }
                }
            });

            if (fullDayDocId) {
                fullDayEventsMap[index] = fullDayDocId;
                newDayData.fullDayWorkId = fullDayDocId;
            }

            newDayData.eventBlocksCount = visibleEvents.getCount();
            newDayData.dayEvents = visibleEvents;
            newDayData.markerEventType = MONTH_EVENTS[markerEventType] as MONTH_EVENTS;
            newDayData.fullDayEvent = fullDayEventType;
            return newDayData;
        });

        /*
        Для реализации этого функционала https://online.sbis.ru/opendoc.html?guid=91a6dcf6-3e06-4372-bb7a-63a262fba426
        При обходе месяца строится карта событий на целый день. В результате карта имеет вид { номерДня: идДокумента }
        На основе карты записываем в последний день события (или в ВС) количество предшествующих дней события
         с таким же ид документа.
        В шаблоне отображается текст события только в последнем дне (или ВС) и двигается до середины диапазона события.
        */
        let lastIndex = null;
        const SUNDAY_WEEK_INDEX = 6;
        Object.keys(fullDayEventsMap).forEach((day, mapIndex) => {
            const dayInt = parseInt(day, 10);
            const dateByIndex = new Date(firstDayMonth.getFullYear(),
               firstDayMonth.getMonth(),
               dayInt);

            if (fullDayEventsMap[dayInt] !== fullDayEventsMap[dayInt + 1] ||
               dateByIndex.getDay() === SUNDAY_WEEK_INDEX) {
                const stackCount = lastIndex === null ? mapIndex + 1 : mapIndex - lastIndex;
                filteredDays[dayInt].fullDayEventLength = stackCount;
                filteredDays[dayInt].fullDayEventStackWidth = stackCount * DAY_CELL_RELATIVE_WIDTH;
                filteredDays[dayInt].fullDayEventStacktitleShift = DAY_CELL_RELATIVE_WIDTH
                    * (dateByIndex.getDay() + 1 - stackCount);
                lastIndex = mapIndex;

                if (stackCount > 1) {
                    filteredDays[dayInt].isShowFullDayEventDuration = true;
                }
            }
        });

        return new Promise((resolve) => resolve({
            id: dateToSql(this._state.dateBegin, TO_SQL_MODE.DATE),
            extData: filteredDays
        }));
    }

    eventHeight(event: UserEventModel, cellRect: ICellRect): number {

        // эмпирически взято из инструментов отладки
        const eventRowsHeight = {
            1: 18,
            2: 32
        };
        const timeTextWidth = 32.44;
        const innerPaddings = 24;

        const eventBottomMargin = 2;
        let eventRows: number = 0;
        let eventText = event.get('description') ? event.get('description')
            : event.get('regulationName')?.length ? event.get('regulationName') : '';
        if (!event.get('isFullDayEvent') && event.get('text').length) {
            eventText += ': ' + event.get('text');
        }
        if ((cellRect.width - innerPaddings) > (timeTextWidth + this.getTextWidth(eventText))
            || (!event.get('text').includes(' ')
                && !event.get('regulationName')?.includes(' ')
                && !event.get('description')?.includes(' ')) ) {
            eventRows = 1;
        } else {
            eventRows = 2;
        }
        return eventRowsHeight[eventRows] + eventBottomMargin;
    }

    getTextWidth(text: string, fontSize: number = 12): number {
        // средняя длинна ASCII символа, высчитаная из таблицы длинн символов
        const avgCharWidth = 0.5279276315789471;
        return text.length * avgCharWidth * fontSize;
    }

    updateWithData(eventsData: RecordSet, scheduleData: RecordSet): void {
        this._legend = {};
        eventsData.forEach((dayElement: Model, dayIndex: number) => {
            const daySchedule = scheduleData?.at(dayIndex);
            const isFestDay = daySchedule?.get('Тип') === 2;
            let dayType;

            this._resetDayElement(dayIndex);

            if (daySchedule) {
                this._daysArray[dayIndex].isFestDay = isFestDay;
                if (daySchedule.get('ДолжностьСотрудника')) {
                    if (daySchedule.get('РабочийДень')) {
                        dayType = 'workday';
                    } else {
                        dayType = 'restday'; // holiday | weekend
                    }
                } else if (isFestDay || daySchedule.get('Тип') === 1) {
                    dayType = 'restday';
                } else {
                    dayType = 'unEmployed';
                }
            }
            this._daysArray[dayIndex].dayScheduleType = dayType;

            const rawEvents = dayElement.get('Данные');
            const events = new RecordSet({
                rawData: rawEvents.getRawData(true),
                adapter: rawEvents.getAdapter(),
                model: UserEventModel
            });
            events.each((event: UserEventModel, index: number) => {
                const docType: string = event.get('typeDoc');

                if (event.get('РаботаУказанногоЛица')) {
                      // В легенду попадают только события указанного лица из основного календаря
                    if (event.get('ОсновнойКалендарь')) {
                        if (!(docType in this._legend)) {
                            this._legend[docType] = {
                                count: 0,
                                duration: 0
                            };
                        }

                        if (docType === 'Отпуск' || docType.startsWith('Плановый отпуск')) {
                            // При расчете легенды по отпускам нужно учитывать,
                            // что праздничные дни вычитаются из дней отпуска
                            // Тут не берем сразу DataObject.VacationDays как выше,
                            // потому что часть отпуска может быть в другом месяце
                            if (!isFestDay) {
                                this._legend[docType].count++;
                            }
                        } else {
                            this._legend[docType].count++;
                            this._legend[docType].duration += event.get('duration');
                        }
                    }
                }
            });

            // TODO Здесь надо перейти на классы, которые дает сопоставление CATEGORY_TO_CLASS
            this._daysArray[dayIndex].dayEvents = events; // Все события. Фильтрация произойдет в getDaysData
        });

        this._version++;
    }
}

export default MonthModel;
