Nodejs-proxy is a simple HTTP proxy server written in node.js. It currently
just proxies all the requests on port 8080.

Nodejs-proxy was written by Peteris Krumins (peter@catonmat.net).
His blog is at http://www.catonmat.net  --  good coders code, great reuse.

------------------------------------------------------------------------------

You'll need node.js to run it. Get it at www.nodejs.org, then compile and
install it:

    $ ./configure
    $ make
    $ make install

Next, run proxy.js through node program:

    $ node proxy.js

And that's it!

I have also added ip-based access control and by default the proxy will
deny all IPs. To add a new ip, just echo it to 'allow_ip_list' file:

    $ echo '1.2.3.4' >> config/allow_ip_list

And you don't need to restart the server, it will see the changes and update
itself.

You can also block hosts based on a regex pattern, to do that, echo the hosts
you don't wish the proxy to serve to 'black_list' file:

    $ echo 'facebook.com' >> config/black_list


More features coming later!


------------------------------------------------------------------------------

Happy proxying!

Sincerely,
Peteris Krumins
http://www.catonmat.net

