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

fs.watchFile(config.black_list,    function(c,p) { update_blacklist(); });
fs.watchFile(config.allow_ip_list, function(c,p) { update_iplist(); });
fs.watchFile(config.host_filters,  function(c,p) { update_hostfilters(); });

function update_list(msg, file, mapf, collectorf) {
  fs.stat(file, function(err, stats) {
    if (!err) {
      sys.log(msg);
      fs.readFile(file, function(err, data) {
        collectorf(data.toString().split("\n")
                   .filter(function(rx) { return rx.length })
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
    function(rx) { return RegExp(rx) },
    function(list) { blacklist = list }
  );
}

function update_iplist() {
  update_list(
    "Updating allowed ip list.",
    config.allow_ip_list,
    function(ip){return ip},
    function(list) { iplist = list }
  );
}

function ip_allowed(ip) {
  return iplist.some(function(ip_) { return ip==ip_; }) || iplist.length <1;
}

function host_allowed(host) {
  return !blacklist.some(function(host_) { return host_.test(host); });
}

function host_filter(host) {
    if(hostfilters[host] !== undefined){
        target = hostfilters[host].redirect;
        if(target !== undefined){
            target = target.split(':');
            var ret = {};
            ret.host = target[0];
            ret.port = target[1] || 80;
            sys.log('redirecting to : '+ret.host+":"+ret.port);
            return ret;
        }
    }
    return {host:host, port:80};
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

function deny(response, msg) {
  response.writeHead(401);
  response.write(msg);
  response.end();
}

function server_cb(request, response) {
  var ip = request.connection.remoteAddress;
  if (!ip_allowed(ip)) {
    msg = "IP " + ip + " is not allowed to use this proxy";
    deny(response, msg);
    sys.log(msg);
    return;
  }

  if (!host_allowed(request.url)) {
    msg = "Host " + request.url + " has been denied by proxy configuration";
    deny(response, msg);
    sys.log(msg);
    return;
  }
  
  //loop filter
  request = prevent_loop(request, response);
  if(!request){return;}
  
  sys.log(ip + ": " + request.method + " " + request.url);
  
  //calc new host info
  var host = host_filter(request.headers.host);
  if(host.port!=80){request.headers.host = host.host+':'+host.port;}
  else{request.headers.host = host.host;}
  
  //launch new request
  try{
    var proxy = http.createClient(host.port || 80, host.host);
    var proxy_request = proxy.request(request.method, request.url, request.headers);
  
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
  
  }catch(err){
    console.log('ERROR: Caught exception: ' + err);
    sys.log("Connection to "+host.host+":"+(host.port||80)+" failed");
  }
}

//last chance error handler
process.on('uncaughtException', function (err) {
  console.log('LAST ERROR: Caught exception: ' + err);
});

//startup + log
update_blacklist();
update_iplist();
update_hostfilters();

config.listen.forEach(function(listen){
  sys.log("Starting reverse proxy server on port '" + listen.ip+':'+listen.port);
  http.createServer(server_cb).listen(listen.port, listen.ip); 
});

