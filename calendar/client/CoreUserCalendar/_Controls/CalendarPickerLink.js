/**
 * кнопка-ссылка  открытия диалога редакирования списка подключенных календарей
 * ВАЖНО: присутствует только в разделе календарь и на стек-панели по шеврону,
 * - только рядом с основным календарем текущего польз-ля
 * Поэтому заргужает и следит за изменениями списка текущих календарей пользователя
 * ...и поставляет этот список в EventCalendarMonitor через Store
 * @class CoreUserCalendar.controls:CalendarPickerLink
 * @extends Control
 * @author Бирюков Виталий Валерьевич
 * @control
 * @public
 */
define(["require", "exports", "tslib", "UI/Base", "Types/source", "CoreUserCalendar/common", "Types/collection", "Controls/Store", "Controls/dataSource", "wml!CoreUserCalendar/_Controls/CalendarPickerLink", "i18n!CoreUserCalendar", "css!CoreUserCalendar/controls"], function (require, exports, tslib_1, Base_1, source_1, common_1, collection_1, Store_1, dataSource_1, template, rk) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var calendarTypes;
    (function (calendarTypes) {
        calendarTypes[calendarTypes["onlineWork"] = 0] = "onlineWork";
        calendarTypes[calendarTypes["onlineCustom"] = 1] = "onlineCustom";
        calendarTypes[calendarTypes["onlineRoom"] = 2] = "onlineRoom";
        calendarTypes[calendarTypes["onlineVehicle"] = 3] = "onlineVehicle";
        calendarTypes[calendarTypes["myPersonal"] = 10] = "myPersonal";
        calendarTypes[calendarTypes["myCustom"] = 11] = "myCustom";
    })(calendarTypes || (calendarTypes = {}));
    var CalendarPickerLink = /** @class */ (function (_super) {
        tslib_1.__extends(CalendarPickerLink, _super);
        function CalendarPickerLink() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = template;
            _this._caption = '';
            _this._isClientAuth = common_1.Helper.isClientAuth();
            _this._listItems = null;
            _this._errorController = new dataSource_1.error.Controller({});
            _this._sourceCfg = {
                endpoint: {
                    contract: 'CalendarPermission'
                },
                keyProperty: '@CalendarPermission',
                model: common_1.CalendarListModel,
                orderProperty: 'Order',
                binding: {
                    move: 'CalendarPermission.Move',
                    query: 'Calendar.ListByPerson'
                }
            };
            _this._listSource = new source_1.SbisService(_this._sourceCfg);
            _this._calendarListFilter = new source_1.Query();
            return _this;
        }
        CalendarPickerLink.prototype._beforeMount = function (options, contxt, receivedState) {
            var _this = this;
            var CALENDAR_TYPES_MY_ALL = [calendarTypes.myCustom, calendarTypes.myPersonal];
            var CALENDAR_TYPES_ONLINE_ALL = [calendarTypes.onlineWork, calendarTypes.onlineCustom,
                calendarTypes.onlineRoom, calendarTypes.onlineVehicle];
            this._calendarListFilter.where({
                TypeCalendars: common_1.Helper.isMySbis() ? CALENDAR_TYPES_MY_ALL : tslib_1.__spreadArrays(CALENDAR_TYPES_ONLINE_ALL, CALENDAR_TYPES_MY_ALL)
            });
            if (options.prefetchResult && options.prefetchResult[0] && options.prefetchResult[0].get) {
                var prefetchRS = options.prefetchResult[0].get('calendar_list');
                this._tab = options.tab;
                var rs = new collection_1.RecordSet({
                    rawData: prefetchRS.getRawData(true),
                    adapter: 'adapter.sbis',
                    model: common_1.CalendarListModel
                });
                this._updateState(rs);
            }
            else {
                return this._listSource.query(this._calendarListFilter).then(function (calendarDataSet) {
                    var calendarList = calendarDataSet.getAll();
                    _this._updateState(calendarList);
                    return calendarList;
                }).catch(function (error) {
                    _this._errorHandler(error);
                    return null;
                });
            }
        };
        CalendarPickerLink.prototype._afterMount = function (options) {
            //
        };
        CalendarPickerLink.prototype._beforeUpdate = function (options) {
            if (this._tab !== options.tab) {
                Store_1.default.dispatch('masterCalendarList', this._listItems);
            }
            this._tab = options.tab;
        };
        CalendarPickerLink.prototype._beforeUnmount = function () {
            //
        };
        CalendarPickerLink.prototype._loadData = function () {
            var _this = this;
            this._listSource.query(this._calendarListFilter).then(function (result) {
                _this._updateState(result.getAll());
            });
        };
        // EventCalendarMonitor -> listChanged -> _loadData -> Store -(masterCalendarList)-> EventCalendarMonitor
        // по событию от ECM обновляет список календарей и передает его обратно в ECM через Store
        CalendarPickerLink.prototype._updateState = function (calendarList) {
            this._listItems = calendarList;
            Store_1.default.dispatch('masterCalendarList', this._listItems);
            this._updateCaption(this._listItems);
        };
        CalendarPickerLink.prototype._updateCaption = function (rs) {
            var numberOfCalendars = rs.getIndicesByValue('Show', true).length;
            var firstIndex = this._listItems.getIndexByValue('Show', true);
            var caption = firstIndex > -1 ? rk(rs.at(firstIndex).get('Caption')) : rk('Календари');
            if (numberOfCalendars > 1) {
                caption = caption + ' ' + rk('и ещё') + ' ' + (numberOfCalendars - 1);
            }
            this._caption = caption;
        };
        CalendarPickerLink.prototype._onDialogClose = function () {
            if (this._listItems.isChanged()) {
                this._loadData();
            }
            // this._updateCaption(this._listItems); - надо делать в onResult, только если изменния сохраняются
        };
        CalendarPickerLink.prototype._openCalendarPicker = function () {
            var calendarList = new source_1.PrefetchProxy({
                data: {
                    query: this._listItems
                },
                target: new source_1.SbisService(this._sourceCfg)
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
        };
        CalendarPickerLink.prototype._onResult = function (event, data) {
            this._saveListChanges(data);
            this._updateCaption(this._listItems);
            this._children.sticky.close();
        };
        CalendarPickerLink.prototype._errorHandler = function (error) {
            var _this = this;
            return this._errorController.process({
                error: error,
                mode: dataSource_1.error.Mode.dialog
            }).then(function (errorViewConfig) {
                _this._errorViewConfig = errorViewConfig;
                return error;
            });
        };
        CalendarPickerLink.prototype._saveListChanges = function (list) {
            var _this = this;
            new source_1.SbisService({
                endpoint: {
                    address: '/service/',
                    contract: 'Calendar'
                }
            }).call('SetShowEvents', {
                Params: list
            }).then(function () {
                // this._loadData(); - здесь обновлять данные не надо, чтбоы не было двойного запроса!
                // обновление будет по событию listChanged от EventCalendarMonitor
            }).catch(function (error) { return _this._errorHandler(error); });
        };
        return CalendarPickerLink;
    }(Base_1.Control));
    exports.default = CalendarPickerLink;
});
