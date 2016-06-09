/* jshint browser: true */
/* globals $, ajaxify, app */ 
$(window).on('action:ajaxify.contentLoaded', function() {
    if (ajaxify.data && ajaxify.data.cid) {
        $('html').attr('data-category-id', ajaxify.data.cid);
    } else {
        $('html').removeAttr('data-category-id');
    }
    if (app.user && app.user.uid) {
        $('html').attr('data-user-id', app.user.uid);
    } else {
        $('html').removeAttr('data-user-id');
    }
});

// fix title thingy
$(window).on('action:ajaxify.end', function() {
    $('[component="navbar/title"] span:hidden').addClass('hidden').removeAttr('style');
});

/* jshint ignore:start */
/* Copyright (c) 2006-2013 Tyler Uebele * Released under the MIT license. * latest at https://github.com/tyleruebele/details-shim * minified by Google Closure Compiler */
function details_shim(a){if(!(a&&"nodeType"in a&&"tagName"in a))return details_shim.init();var b;if("details"==a.tagName.toLowerCase())b=a.getElementsByTagName("summary")[0];else if(a.parentNode&&"summary"==a.tagName.toLowerCase())b=a,a=b.parentNode;else return!1;if("boolean"==typeof a.open)return a.getAttribute("data-open")||(a.className=a.className.replace(/\bdetails_shim_open\b|\bdetails_shim_closed\b/g," ")),!1;var c=a.outerHTML||(new XMLSerializer).serializeToString(a),c=c.substring(0,c.indexOf(">")),
c=-1!=c.indexOf("open")&&-1==c.indexOf('open=""')?"open":"closed";a.setAttribute("data-open",c);a.className+=" details_shim_"+c;b.addEventListener?b.addEventListener("click",function(){details_shim.toggle(a)}):b.attachEvent&&b.attachEvent("onclick",function(){details_shim.toggle(a)});Object.defineProperty(a,"open",{get:function(){return"open"==this.getAttribute("data-open")},set:function(a){details_shim.toggle(this,a)}});for(b=0;b<a.childNodes.length;b++)if(3==a.childNodes[b].nodeType&&/[^\s]/.test(a.childNodes[b].data)){var c=
document.createElement("span"),d=a.childNodes[b];a.insertBefore(c,d);a.removeChild(d);c.appendChild(d)}}details_shim.toggle=function(a,b){b="undefined"===typeof b?"open"==a.getAttribute("data-open")?"closed":"open":b?"open":"closed";a.setAttribute("data-open",b);a.className=a.className.replace(/\bdetails_shim_open\b|\bdetails_shim_closed\b/g," ")+" details_shim_"+b};details_shim.init=function(){for(var a=document.getElementsByTagName("summary"),b=0;b<a.length;b++)details_shim(a[b])};
window.addEventListener?window.addEventListener("load",details_shim.init,!1):window.attachEvent&&window.attachEvent("onload",details_shim.init);

$(window).on('action:ajaxify.contentLoaded', details_shim.init);
$(window).on('action:posts.loaded', details_shim.init);

/* jshint ignore:end */
