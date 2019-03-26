/// <amd-module name='CoreUserCalendar/Controls/Options/View' />
import * as Control from 'Core/Control';
import {Memory} from 'Types/source';
import * as template from 'wml!CoreUserCalendar/Controls/Options/View/View';
import 'css!theme?Controls/Dropdown/resources/template/DropdownList';
import 'css!CoreUserCalendar/Controls/Options/View/View';
import 'i18n!CoreUserCalendar/Controls/Options/View';
import {rk} from 'Core/i18n';

/**
 * Bottom-part для окна конфигурации -'Настройки календаря'
 * @extends Core.Control
 * @author Гусев Евгений Николаевич
 * @control
 * @public
 */

const View = Control.extend({
   _template: template,
   _showWeekend: true,
   _gridType: null,
   _typesItems: null,
   _quantum: null,
   _quantumItems: null,
   _border: null,
   _borderItems: null,
   _daysCount: null,
   _daysItems: null,

   _beforeMount(): void {
      this._daysItems = [
         {
            key: 1,
            title: rk('1 день')
         },
         {
            key: 2,
            title: rk('2 дня')
         },
         {
            key: 3,
            title: rk('3 дня')
         },
         {
            key: 4,
            title: rk('4 дня')
         },
         {
            key: 5,
            title: rk('5 дней')
         },
         {
            key: 6,
            title: rk('6 дней')
         },
         {
            key: 7,
            title: rk('7 дней')
         }
      ];

      this._daysCount = [2]; //TODO: delete
   },

   _createMemory(items: object): Memory {
      return new Memory({
         idProperty: 'key',
         data: items
      });
   },

   _saveSettings(): void {
      const notice = this._children.noticeSettings;
      const optionsCalendarParams = {
         showMode: this._gridType[0],
         quantumTime: this._quantum[0],
         timeIntervalMiddle: this._border[0],
         periodDayCount: this._daysCount[0],
         showWeekend: this._showWeekend
      };

      notice && notice.saveSettings();
   },

   getDefaultOptions(): object {
      return {
         _gridType: ['interval'],
         _quantum: ['h'],
         _border: [13],
         _daysCount: [2],
         _showWeekend: true
      };
   }
});

export = View;
