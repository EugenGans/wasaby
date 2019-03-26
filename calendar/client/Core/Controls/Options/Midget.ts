/// <amd-module name='CoreUserCalendar/Controls/Options/Midget' />
import * as Control from 'Core/Control';
import * as dateFormat from 'Core/helpers/Date/format';
import {Memory} from 'Types/source';
import * as template from 'wml!CoreUserCalendar/Controls/Options/Midget/Midget';
import * as contentGridType from 'wml!CoreUserCalendar/Controls/Options/Midget//contentGridType';
import 'css!CoreUserCalendar/Controls/Options/Midget/Midget';
import 'i18n!CoreUserCalendar/Controls/Options/Midget';
import {rk} from 'Core/i18n';

/**
 * Миниатюра календаря с настройками дней, выходных, сетки
 * @extends Core.Control
 * @author Гусев Евгений Николаевич
 * @control
 * @public
 */

const Midget = Control.extend({
   _template: template,
   _contentGridType: contentGridType,
   _days: [],
   _showWeekend: true,
   _daysCount: 7,
   _gridType: null,
   _typesItems: null,
   _quantum: null,
   _quantumItems: null,
   _border: null,
   _borderItems: null,
   _daysItems: null,

   _beforeMount(): void {
      this._gridType = ['interval'];
      this._quantum = ['h'];
      this._border = [13];

      let hour = 0;

      this._typesItems = [
         {
            key: 'interval',
            caption: rk('На интервалы'),
            icon: 'icon-16 icon-ListNumbered icon-primary'
         },
         {
            key: 'beforeAfter',
            caption: rk('На до и после'),
            icon: 'icon-16 icon-separateHorizontal icon-primary'
         },
         {
            key: 'allDay',
            caption: rk('Целиком на день'),
            icon: 'icon-16 icon-PicCenter icon-primary'
         }
      ];
      this._quantumItems = [
         {
            key: 'h',
            title: rk('1 час')
         },
         {
            key: '30m',
            title: rk('30 мин')
         },
         {
            key: '15m',
            title: rk('15 мин')
         }
      ];
      this._borderItems = [];
      while (++hour < 24) {
         this._borderItems.push({
            key: hour,
            title: ('0' + hour).slice(-2) + ':00'
         });
      }

      this._beforeUpdate();
   },

   _beforeUpdate(): void {
      const grid = this._gridType[0];
      const h = grid === 'interval' ? 24 : 10;
      let day = this._daysCount < 3 ? 5 : 8 - this._daysCount;
      const date = new Date(2018, 0, 1);
      let count = 0;
      let isOff;

      this._days = [];
      while (count < this._daysCount) {
         isOff = day === 6 || day === 7;
         if (!this._showWeekend && isOff) {
            day++;
            continue;
         }
         date.setDate(day);
         this._days.push({
            name: day + ' ' + dateFormat(date, 'dddd'),
            isOff: isOff,
            align: grid !== 'interval' ? '' : 'ws-justify-content-around',
            events: isOff ? [] : (day % 2 ? [h, h] : [h, h, h, h, h])
         });
         day++;
         count++;
      }
   },

   _createMemory(items: object): Memory {
      return new Memory({
         idProperty: 'key',
         data: items
      });
   }
});

export = Midget;
