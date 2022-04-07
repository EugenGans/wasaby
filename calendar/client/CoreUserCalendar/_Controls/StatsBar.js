define(["require", "exports", "tslib", "UI/Base", "CoreUserCalendar/common", "wml!CoreUserCalendar/_Controls/StatsBar", "css!CoreUserCalendar/year"], function (require, exports, tslib_1, Base_1, common_1, template) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ALLOWED_TYPES = [
        'Командировка',
        'Отпуск',
        'Больничный',
        'Прогул',
        'Простой',
        'Отгул'
    ];
    /**
     * Компонент статистики событий за год
     * @author Birukov VV
     */
    var StatsBar = /** @class */ (function (_super) {
        tslib_1.__extends(StatsBar, _super);
        function StatsBar() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = template;
            _this._items = [];
            return _this;
        }
        // region Lifecycle hooks
        StatsBar.prototype._beforeMount = function (options, context, receivedState) {
            // TODO afterMOunt
            this._updateState(options);
        };
        StatsBar.prototype._afterMount = function (options) {
            // TODO afterMount
        };
        StatsBar.prototype._beforeUnmount = function () {
            // TODO remove subscriptions
        };
        StatsBar.prototype._beforeUpdate = function (options) {
            if (options.stats !== this._options.stats) {
                this._updateState(options);
            }
        };
        StatsBar.prototype._afterUpdate = function (oldOptions) {
            // TODO afterUpdate
        };
        StatsBar.prototype._updateState = function (options) {
            var newItems = [];
            for (var item in options.stats) {
                if (ALLOWED_TYPES.includes(item)) {
                    newItems.push({
                        name: item,
                        count: options.stats[item].count,
                        icon: common_1.dictionary.DOC_ICONS[item],
                        colorClass: common_1.dictionary.FULLDAY_EVENTS_TYPES[item]
                    });
                }
            }
            this._items = newItems;
        };
        StatsBar.prototype._toggleCaption = function (e, index) {
            this._expandedCaptionItem = this._expandedCaptionItem === index ? undefined : index;
        };
        return StatsBar;
    }(Base_1.Control));
    exports.default = StatsBar;
});
