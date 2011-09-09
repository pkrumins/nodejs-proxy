this dir contains config files for nodejs-proxy.
they include:

* allow_ip_list - a file that contains allowed ips
* black_list    - a file that contains blocked urls (can be regexes)
* hostfilters.js- a file that contains JSON host special actions
example:
    {
        "hostname.domain.tld": {
            "redirect": "localhost:3001"
        }
    }

