this dir contains config files for nodejs-proxy.
they include:

* allow_ip_list - a file that contains allowed ips
* black_list    - a file that contains blocked urls (can be regexes)
* hostfilters.js- a file that contains JSON host special actions

hostfilters is used to define special actions to take. All rules are of the form
"target host:port" => action(s)
Currently, the proxy code tries to find a rule with the following priority :
1) domain:port
2) domain
3) *:port => default rule for incomming connections to port 80
4) *      => default rule
5) default: proxyto what the host directive contains ;-)

Please note that the rules are based on the *target* host:port located in the 
"host" header of the http request. For example, the real target port **may** be
different from the listening port on this server.

We currently support only 2 kind of rules, they are looked up with the following 
priority :
1) redirect => will issue a 301 to the browser
2) proxyto  => will lead to a "regular" reverse proxying
3) default is to proxy

NOTA: only http is supported, no HTTPS yet

example:
    {
        "hostname.domain.tld": {
            "redirect": "www.google.com"
        },
        "*:80":{
            "proxyto": "localhost:80"
        }
    }


A security preventing proxying loop is harcoded. A request that has been proxied 
once will not be able to go thru a second time. Please let me know if this is a 
limitation for you (jtlebi on github).