package com.daralhikayat.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "RemoteServer")
public class RemoteServerPlugin extends Plugin {

    @PluginMethod
    public void getLocalIpAddress(PluginCall call) {
        try {
            JSArray ipsArray = new JSArray();
            String primaryIp = "";

            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                if (!intf.isUp() || intf.isLoopback()) {
                    continue;
                }
                String ifName = intf.getName().toLowerCase();
                if (ifName.contains("tun") || ifName.contains("p2p") || ifName.contains("vnet") || ifName.contains("docker")) {
                    continue;
                }

                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (addr.isLoopbackAddress()) {
                        continue;
                    }
                    String hostAddress = addr.getHostAddress();
                    if (hostAddress != null && hostAddress.indexOf(':') < 0) { // IPv4
                        if (hostAddress.startsWith("127.") || hostAddress.startsWith("169.254.")) {
                            continue;
                        }
                        ipsArray.put(hostAddress);
                        if (primaryIp.isEmpty() || ifName.contains("wlan") || ifName.contains("ap")) {
                            primaryIp = hostAddress;
                        }
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("ips", ipsArray);
            result.put("primaryIp", primaryIp.isEmpty() ? "127.0.0.1" : primaryIp);
            result.put("port", 3000);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get local IPv4 address", e);
        }
    }
}
