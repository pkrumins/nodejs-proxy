/*
** Peteris Krumins (peter@catonmat.net)
** http://www.catonmat.net  --  good coders code, great reuse
**
** A simple proxy server written in node.js.
**
*/

var config = {
  allow_ip_list: './config/allow_ip_list',
  black_list:    './config/black_list',
  host_filters:   './config/hostfilters.js',
  listen:[{ip:'0.0.0.0', port:80},//all ipv4 interfaces
          {ip:'::', port:80}]//all ipv6 interfaces
};

exports.config = config;

