define(["require", "exports", "tslib", "UI/Base", "Types/formatter", "EngineUser/Info", "CoreUserCalendar/common", "wml!CoreUserCalendar/_Controls/QuickButtons", "Types/source", "Controls/dataSource", "Controls/Store"], function (require, exports, tslib_1, Base_1, formatter_1, Info_1, common_1, template, source_1, dataSource_1, Store_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var quickTypes = ['Отгул', 'Больничный', 'Отпуск'];
    var defaultConfig = {
        Отгул: {
            name: 'time_off',
            iconName: 'icon-SelfVacation',
            iconStyle: 'wtm-custom',
            buttonStyle: 'success',
            caption: 'Отгул',
            tooltip: 'Создать отгул',
            doc_type: 'Отгул'
        },
        Отпуск: {
            name: 'vacation',
            iconName: 'icon-Vacation',
            iconStyle: 'wtm-custom',
            buttonStyle: 'success',
            caption: 'Отпуск',
            tooltip: 'Создать отпуск',
            doc_type: 'Отпуск'
        },
        Больничный: {
            name: 'hospital',
            iconName: 'icon-Sick',
            iconStyle: 'wtm-custom',
            buttonStyle: 'success',
            caption: 'Больничный',
            tooltip: 'Создать больничный',
            doc_type: 'Больничный'
        }
    };
    var QuickButtons = /** @class */ (function (_super) {
        tslib_1.__extends(QuickButtons, _super);
        function QuickButtons() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = template;
            _this._hasButtons = false;
            _this._isClientAuth = common_1.Helper.isClientAuth();
            _this._isMySbis = common_1.Helper.isMySbis();
            _this._errorController = new dataSource_1.error.Controller({});
            _this._buttonsConfig = [];
            return _this;
        }
        QuickButtons.prototype._beforeMount = function (options) {
            var _this = this;
            var _a, _b;
            if (!this._isMySbis) {
                this._person = options.personID || Info_1.Info.get('ЧастноеЛицо');
                this._tab = options.tab;
                if ((_b = (_a = options.prefetchResult) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.get('documents_menu')) {
                    var documentsMenu = options.prefetchResult[0].get('documents_menu');
                    this._updateConfig(documentsMenu);
                }
                else {
                    return this._fetchDocumentsMenu(options).then(function (documentsMenu) {
                        _this._updateConfig(documentsMenu);
                    });
                }
            }
        };
        QuickButtons.prototype._beforeUnmount = function () {
            //
        };
        QuickButtons.prototype._fetchDocumentsMenu = function (options) {
            var _this = this;
            if (options === void 0) { options = this._options; }
            var menuSource = new source_1.SbisService({
                endpoint: 'WorkTimeManagement',
                binding: {
                    query: 'DocumentsMenu'
                },
                keyProperty: 'id',
                nodeProperty: 'is_doc_type_root',
                parentProperty: 'parent'
            });
            var filter = {
                calendar: this._options.calendarUUID || null,
                date: formatter_1.dateToSql(new Date(), formatter_1.TO_SQL_MODE.DATE),
                onlyMain: false,
                person_id: this._person,
                source: 'calendar'
            };
            return menuSource.query(new source_1.Query().where(filter)).then(function (result) {
                return result.getAll();
            }).catch(function (error) {
                _this._errorHandler(error);
                return null;
            });
        };
        QuickButtons.prototype._updateConfig = function (menuResult) {
            var _a;
            var typesSet = new Set();
            (_a = menuResult) === null || _a === void 0 ? void 0 : _a.each(function (itemsRow) {
                var docType = itemsRow.get('doc_type');
                if (quickTypes.includes(docType)) {
                    typesSet.add(docType);
                }
            });
            this._buttonsConfig = Array.from(typesSet).map(function (item) {
                return defaultConfig[item];
            });
            this._hasButtons = this._buttonsConfig.length ? true : false;
        };
        QuickButtons.prototype._errorHandler = function (error) {
            var _this = this;
            return this._errorController.process({
                error: error,
                mode: dataSource_1.error.Mode.dialog
            }).then(function (errorViewConfig) {
                _this._errorViewConfig = errorViewConfig;
                return error;
            });
        };
        /**
         * Отркывашка панели информации о дне в режиме создания документа
         * @param event
         * @param config
         * @protected
         */
        QuickButtons.prototype._openDayInfo = function (event, config) {
            var calendarCreateDate = Store_1.default.get('calendarCreateDate');
            this._children.dayInfoOpener.openDayInfo({
                person: this._person || Info_1.Info.get('ЧастноеЛицо') || 0,
                preferCalendar: true,
                useAllPositions: true,
                positionsWithDoc: false,
                dialogViewMode: 'wide',
                showPerson: false,
                createDocument: {
                    docType: config.doc_type
                },
                date: this._options.createDate || calendarCreateDate || new Date()
            }, this, null);
        };
        return QuickButtons;
    }(Base_1.Control));
    exports.default = QuickButtons;
});
