/*
** Peteris Krumins (peter@catonmat.net)
** http://www.catonmat.net  --  good coders code, great reuse
**
** A simple proxy server written in node.js.
**
*/

var config = {
  add_proxy_header: true,
  allow_ip_list: './config/allow_ip_list',
  black_list:    './config/black_list',
  host_filters:   './config/hostfilters.js',
  listen:[{ip:'91.121.154.113', port:80},
          {ip:'2001:41d0:1:db71::1', port:80}]    
};

exports.config = config;

