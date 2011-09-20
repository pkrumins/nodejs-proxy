/*
** Peteris Krumins (peter@catonmat.net)
** http://www.catonmat.net  --  good coders code, great reuse
**
** A simple proxy server written in node.js.
**
*/

var http = require('http');
var sys  = require('sys');
var fs   = require('fs');

var config = require('./config').config;

var blacklist = [];
var iplist    = [];
var hostfilters = {};


//support functions
function hosthelper(host){
    out={};
    host = host.split(':');
    out.host = host[0];
    out.port = host[1] || 80;
    return out;
}

function hostporthelper(host){
    return host.host+((host.port==80)?"":":"+host.port);
}

//config files watchers
fs.watchFile(config.black_list,    function(c,p) { update_blacklist(); });
fs.watchFile(config.allow_ip_list, function(c,p) { update_iplist(); });
fs.watchFile(config.host_filters,  function(c,p) { update_hostfilters(); });


//config files loaders/updaters
function update_list(msg, file, mapf, collectorf) {
  fs.stat(file, function(err, stats) {
    if (!err) {
      sys.log(msg);
      fs.readFile(file, function(err, data) {
        collectorf(data.toString().split("\n")
                   .filter(function(rx){return rx.length;})
                   .map(mapf));
      });
    }
    else {
      sys.log("File '" + file + "' was not found.");
      collectorf([]);
    }
  });
}

function update_hostfilters(){
    file = config.host_filters;
    fs.stat(file, function(err, stats) {
    if (!err) {
      sys.log("Updating host filter");
      fs.readFile(file, function(err, data) {        
        hostfilters = JSON.parse(data.toString());
      });
    }
    else {
      sys.log("File '" + file + "' was not found.");
      hostfilters = {};
    }
  });
}

function update_blacklist() {
  update_list(
    "Updating host black list.",
    config.black_list,
    function(rx){return RegExp(rx);},
    function(list){blacklist = list;}
  );
}

function update_iplist() {
  update_list(
    "Updating allowed ip list.",
    config.allow_ip_list,
    function(ip){return ip;},
    function(list){iplist = list;}
  );
}


//filtering rules
function ip_allowed(ip) {
  return iplist.some(function(ip_) { return ip==ip_; }) || iplist.length <1;
}

function host_allowed(host) {
  return !blacklist.some(function(host_) { return host_.test(host); });
}

//header decoding
function authenticate(request){
  token={
        "login":"anonymous",
        "pass":""
      };
  if (request.headers.authorization && request.headers.authorization.search('Basic ') === 0) {
    // fetch login and password
    basic = (new Buffer(request.headers.authorization.split(' ')[1], 'base64').toString());
    sys.log("Authentication token received: "+basic);
    basic = basic.split(':');
    token.login = basic[0];
    token.pass  = basic[1];//fixme: potential trouble if there is a ":" in the pass
  }
  return token;
}

//proxying
//handle 2 rules:
//  * redirect (301)
//  * proxyto
function handle_proxy_rule(rule, target, token){
  //handle authorization
  if("validuser" in rule){
      if(!(token.login in rule.validuser) || (rule.validuser[token.login] != token.pass)){
         target.action = "authenticate";
         target.msg = rule.description || "";
         return target;
      }
  }
  
  //handle real acions
  if("redirect" in rule){
    target = hosthelper(rule.redirect);
    target.action = "redirect";
  } else if("proxyto" in rule){
    target = hosthelper(rule.proxyto);
    target.action = "proxyto";
  }
  return target;
}

function host_filter(host, token) {
    //extract target host and port
    action = hosthelper(host);
    action.action="proxyto";
    
    //try to find a matching rule
    if(action.host+':'+action.port in hostfilters){
      rule=hostfilters[action.host+':'+action.port];
      action=handle_proxy_rule(rule, action, token);
    }else if (action.host in hostfilters){
      rule=hostfilters[action.host];
      action=handle_proxy_rule(rule, action, token);
    }else if ("*:"+action.port in hostfilters){
      rule=hostfilters['*:'+action.port];
      action=handle_proxy_rule(rule, action, token);
    }else if ("*" in hostfilters){
      rule=hostfilters['*'];
      action=handle_proxy_rule(rule, action, token);
    }
    return action;
}

function prevent_loop(request, response){
  if(request.headers.proxy=="node.jtlebi"){
    sys.log("Loop detected");
    response.writeHead(500);
    response.write("Proxy loop !");
    response.end();
    return false;
  } else {
    request.headers.proxy="node.jtlebi";
    return request;
  }
}

function action_authenticate(response, msg){
  response.writeHead(401,{
    'WWW-Authenticate': "Basic realm=\""+msg+"\""
  });
  response.end();
}

function action_deny(response, msg) {
  response.writeHead(403);
  response.write(msg);
  response.end();
}

function action_notfound(response, msg){
  response.writeHead(404);
  response.write(msg);
  response.end();
}

function action_redirect(response, host){
  sys.log("Redirecting to " + host);
  response.writeHead(301,{
    'Location': "http://"+host
  });
  response.end();
}

function action_proxy(response, request, host){
  sys.log("Proxying to " + host);
    
  //launch new request
  var proxy = http.createClient(action.port, action.host);
  var proxy_request = proxy.request(request.method, request.url, request.headers);
  
  //deal with errors, timeout, con refused, ...
  proxy.on('error', function(err) {
    sys.log(err.toString() + " on request to " + host);
    return action_notfound(response, "Requested resource ("+request.url+") is not accessible on host \""+host+"\"");
  });
  
  //proxies to FORWARD answer to real client
  proxy_request.addListener('response', function(proxy_response) {
    proxy_response.addListener('data', function(chunk) {
      response.write(chunk, 'binary');
    });
    proxy_response.addListener('end', function() {
      response.end();
    });
    response.writeHead(proxy_response.statusCode, proxy_response.headers);
  });

  //proxies to SEND request to real server
  request.addListener('data', function(chunk) {
    proxy_request.write(chunk, 'binary');
  });
  request.addListener('end', function() {
    proxy_request.end();
  });
}

//special security logging function
function security_log(request, response, msg){
  var ip = request.connection.remoteAddress;
  msg = "**SECURITY VIOLATION**, "+ip+","+request.method||""+" "+request.url||""+","+msg;
  
  sys.log(msg);
}

//security filter
// true if OK
// false to return immediatlely
function security_filter(request, response){
  //HTTP 1.1 protocol violation: no host, no method, no url
  if(request.headers.host === undefined ||
     request.method === undefined ||
     request.url === undefined){
    security_log(request, response, "Either host, method or url is poorly defined");
    return false;
  }
  return true;
}

//actual server loop
function server_cb(request, response) {
  //the *very* first action here is to handle security conditions
  //all related actions including logging are done by specialized functions
  //to ensure compartimentation
  if(!security_filter(request, response)) return;
  
  
  var ip = request.connection.remoteAddress;
  if (!ip_allowed(ip)) {
    msg = "IP " + ip + " is not allowed to use this proxy";
    action_deny(response, msg);
    sys.log(msg);
    return;
  }

  if (!host_allowed(request.url)) {
    msg = "Host " + request.url + " has been denied by proxy configuration";
    action_deny(response, msg);
    sys.log(msg);
    return;
  }
  
  //loop filter
  request = prevent_loop(request, response);
  if(!request){return;}
  
  sys.log(ip + ": " + request.method + " " + request.url);
  
  //get authorization token
  authorization = authenticate(request);
  
  //calc new host info
  var action = host_filter(request.headers.host, authorization);
  host = hostporthelper(action);
  
  //handle action
  if(action.action == "redirect"){
    action_redirect(response, host);
  }else if(action.action == "proxyto"){
    action_proxy(response, request, host);
  } else if(action.action == "authenticate"){
    action_authenticate(response, action.msg);
  }
}

//last chance error handler
//de-comment it in a production env for more stability :)
/*process.on('uncaughtException', function (err) {
  console.log('LAST ERROR: Caught exception: ' + err);
});*/

//startup + log
update_blacklist();
update_iplist();
update_hostfilters();

config.listen.forEach(function(listen){
  sys.log("Starting reverse proxy server on port '" + listen.ip+':'+listen.port);
  http.createServer(server_cb).listen(listen.port, listen.ip); 
});

