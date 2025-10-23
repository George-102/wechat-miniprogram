// utils/formatTime.js

/**
 * 时间格式化工具类
 * 提供各种时间格式化和处理功能
 */

class FormatTime {
  /**
   * 格式化时间为相对时间（如：刚刚、5分钟前）
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @param {boolean} withSuffix - 是否显示后缀
   * @returns {string} 格式化后的时间字符串
   */
  static relativeTime(timestamp, withSuffix = true) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 时间差计算
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;
    
    if (diff < minute) {
      return withSuffix ? '刚刚' : '现在';
    } else if (diff < hour) {
      const minutes = Math.floor(diff / minute);
      return withSuffix ? `${minutes}分钟前` : `${minutes}分钟`;
    } else if (diff < day) {
      const hours = Math.floor(diff / hour);
      return withSuffix ? `${hours}小时前` : `${hours}小时`;
    } else if (diff < week) {
      const days = Math.floor(diff / day);
      return withSuffix ? `${days}天前` : `${days}天`;
    } else if (diff < month) {
      const weeks = Math.floor(diff / week);
      return withSuffix ? `${weeks}周前` : `${weeks}周`;
    } else if (diff < year) {
      const months = Math.floor(diff / month);
      return withSuffix ? `${months}个月前` : `${months}个月`;
    } else {
      const years = Math.floor(diff / year);
      return withSuffix ? `${years}年前` : `${years}年`;
    }
  }

  /**
   * 格式化时间为指定格式
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @param {string} format - 格式字符串
   * @returns {string} 格式化后的时间字符串
   */
  static format(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const formatMap = {
      'YYYY': date.getFullYear(),
      'MM': String(date.getMonth() + 1).padStart(2, '0'),
      'DD': String(date.getDate()).padStart(2, '0'),
      'HH': String(date.getHours()).padStart(2, '0'),
      'mm': String(date.getMinutes()).padStart(2, '0'),
      'ss': String(date.getSeconds()).padStart(2, '0'),
      'M': date.getMonth() + 1,
      'D': date.getDate(),
      'H': date.getHours(),
      'm': date.getMinutes(),
      's': date.getSeconds()
    };
    
    return format.replace(/(YYYY|MM|DD|HH|mm|ss|M|D|H|m|s)/g, (match) => {
      return formatMap[match] || match;
    });
  }

  /**
   * 格式化时间为聊天显示格式
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @returns {string} 聊天格式时间
   */
  static chatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    if (date >= today) {
      // 今天
      return this.format(timestamp, 'HH:mm');
    } else if (date >= yesterday) {
      // 昨天
      return `昨天 ${this.format(timestamp, 'HH:mm')}`;
    } else if (date >= weekAgo) {
      // 一周内
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      const dayOfWeek = weekDays[date.getDay()];
      return `周${dayOfWeek} ${this.format(timestamp, 'HH:mm')}`;
    } else {
      // 更早
      return this.format(timestamp, 'MM-DD HH:mm');
    }
  }

  /**
   * 格式化时间为日期显示格式
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @returns {string} 日期格式时间
   */
  static dateTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const isSameYear = date.getFullYear() === now.getFullYear();
    
    if (isSameYear) {
      return this.format(timestamp, 'MM-DD HH:mm');
    } else {
      return this.format(timestamp, 'YYYY-MM-DD HH:mm');
    }
  }

  /**
   * 获取时间的友好显示
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @returns {string} 友好时间显示
   */
  static friendlyTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const day = 24 * 60 * 60 * 1000;
    
    if (diff < day) {
      return this.relativeTime(timestamp);
    } else if (diff < 7 * day) {
      const days = Math.floor(diff / day);
      return `${days}天前`;
    } else {
      return this.format(timestamp, 'YYYY年MM月DD日');
    }
  }

  /**
   * 计算剩余时间
   * @param {string|number|Date} endTime - 结束时间
   * @returns {Object} 剩余时间对象
   */
  static countDown(endTime) {
    if (!endTime) return null;
    
    const end = new Date(endTime).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    
    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        expired: true
      };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return {
      days,
      hours,
      minutes,
      seconds,
      expired: false
    };
  }

  /**
   * 格式化时长（秒转为时分秒）
   * @param {number} seconds - 秒数
   * @returns {string} 格式化后的时长
   */
  static formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }
  }

  /**
   * 获取星期几
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @param {boolean} withWeek - 是否包含"星期"前缀
   * @returns {string} 星期几
   */
  static getWeekDay(timestamp, withWeek = true) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const day = weekDays[date.getDay()];
    
    return withWeek ? `星期${day}` : day;
  }

  /**
   * 判断是否为今天
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @returns {boolean} 是否为今天
   */
  static isToday(timestamp) {
    if (!timestamp) return false;
    
    const date = new Date(timestamp);
    const today = new Date();
    
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  /**
   * 判断是否为今年
   * @param {string|number|Date} timestamp - 时间戳或日期字符串
   * @returns {boolean} 是否为今年
   */
  static isThisYear(timestamp) {
    if (!timestamp) return false;
    
    const date = new Date(timestamp);
    const today = new Date();
    
    return date.getFullYear() === today.getFullYear();
  }
}

// 导出实例
module.exports = FormatTime;