define(["require", "exports", "tslib", "UI/Base", "wml!CoreUserCalendar/_Controls/HomeButton"], function (require, exports, tslib_1, Base_1, _template) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var HomeButton = /** @class */ (function (_super) {
        tslib_1.__extends(HomeButton, _super);
        function HomeButton() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = _template;
            return _this;
        }
        HomeButton.prototype._onClick = function () {
            this._notify('dateChanged', [new Date()], { bubbling: true });
        };
        return HomeButton;
    }(Base_1.Control));
    exports.default = HomeButton;
});
