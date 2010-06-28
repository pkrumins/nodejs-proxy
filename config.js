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
  proxy_port:    8080
};

exports.config = config;

