#!/usr/bin/env python3
"""
Test MQTT broker connectivity
"""
import socket
import ssl
import time
from typing import Tuple, Optional

def test_tcp_connection(host: str, port: int, timeout: int = 5) -> Tuple[bool, Optional[str]]:
    """Test TCP connection to MQTT broker"""
    try:
        print(f"🔌 Testing TCP connection to {host}:{port}...")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        
        start_time = time.time()
        result = sock.connect_ex((host, port))
        end_time = time.time()
        
        sock.close()
        
        if result == 0:
            latency = round((end_time - start_time) * 1000, 2)
            return True, f"✅ TCP connection successful (latency: {latency}ms)"
        else:
            return False, f"❌ TCP connection failed (error code: {result})"
            
    except socket.gaierror:
        return False, f"❌ DNS resolution failed for {host}"
    except Exception as e:
        return False, f"❌ Connection error: {str(e)}"

def test_websocket_connection(host: str, port: int, path: str = "/mqtt", timeout: int = 5) -> Tuple[bool, Optional[str]]:
    """Test WebSocket connection to MQTT broker"""
    try:
        print(f"🌐 Testing WebSocket connection to ws://{host}:{port}{path}...")
        
        # Basic HTTP GET request to test WebSocket endpoint
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        
        # Connect
        result = sock.connect_ex((host, port))
        if result != 0:
            sock.close()
            return False, f"❌ WebSocket TCP connection failed (error code: {result})"
        
        # Send WebSocket handshake
        handshake = f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
        sock.send(handshake.encode())
        
        # Receive response
        response = sock.recv(1024).decode()
        sock.close()
        
        if "101 Switching Protocols" in response:
            return True, "✅ WebSocket handshake successful"
        elif "400 Bad Request" in response:
            return False, "❌ WebSocket: Bad Request (MQTT endpoint may not support WebSocket)"
        elif "404 Not Found" in response:
            return False, "❌ WebSocket: MQTT endpoint not found"
        else:
            return False, f"❌ WebSocket: Unexpected response - {response[:100]}"
            
    except Exception as e:
        return False, f"❌ WebSocket error: {str(e)}"

def test_ssl_websocket_connection(host: str, port: int, path: str = "/mqtt", timeout: int = 5) -> Tuple[bool, Optional[str]]:
    """Test secure WebSocket connection to MQTT broker"""
    try:
        print(f"🔒 Testing Secure WebSocket connection to wss://{host}:{port}{path}...")
        
        # Create SSL context
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        # Connect with SSL
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        
        # Wrap socket with SSL
        ssl_sock = context.wrap_socket(sock, server_hostname=host)
        
        # Connect
        result = ssl_sock.connect_ex((host, port))
        if result != 0:
            ssl_sock.close()
            return False, f"❌ Secure WebSocket connection failed (error code: {result})"
        
        # Send WebSocket handshake
        handshake = f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
        ssl_sock.send(handshake.encode())
        
        # Receive response
        response = ssl_sock.recv(1024).decode()
        ssl_sock.close()
        
        if "101 Switching Protocols" in response:
            return True, "✅ Secure WebSocket handshake successful"
        elif "400 Bad Request" in response:
            return False, "❌ Secure WebSocket: Bad Request (MQTT endpoint may not support WebSocket)"
        elif "404 Not Found" in response:
            return False, "❌ Secure WebSocket: MQTT endpoint not found"
        else:
            return False, f"❌ Secure WebSocket: Unexpected response - {response[:100]}"
            
    except Exception as e:
        return False, f"❌ Secure WebSocket error: {str(e)}"

def main():
    """Main test function"""
    print("🚀 MQTT Broker Connectivity Test")
    print("=" * 50)
    
    # MQTT broker configuration
    host = "89.24.76.191"
    ports = {
        "MQTT (TCP)": 1883,
        "MQTT over SSL": 8883,
        "MQTT over WebSocket": 9001,
        "MQTT over Secure WebSocket": 9002
    }
    
    print(f"🎯 Testing broker: {host}")
    print()
    
    results = []
    
    # Test TCP connections
    for name, port in ports.items():
        success, message = test_tcp_connection(host, port)
        results.append((name, success, message))
        print(message)
    
    print()
    
    # Test WebSocket connections
    ws_success, ws_message = test_websocket_connection(host, 9001, "/mqtt")
    results.append(("WebSocket", ws_success, ws_message))
    print(ws_message)
    
    wss_success, wss_message = test_ssl_websocket_connection(host, 9002, "/mqtt")
    results.append(("Secure WebSocket", wss_success, wss_message))
    print(wss_message)
    
    print()
    print("=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    successful = 0
    total = len(results)
    
    for name, success, message in results:
        status = "✅" if success else "❌"
        print(f"{status} {name}: {message.split(' - ')[0] if ' - ' in message else message}")
        if success:
            successful += 1
    
    print()
    print(f"🎯 Results: {successful}/{total} connections successful")
    
    if successful > 0:
        print("✅ MQTT broker is accessible!")
        
        # Recommendations
        print()
        print("💡 RECOMMENDATIONS:")
        if any("WebSocket" in r[0] and r[1] for r in results):
            print("🌐 Use WebSocket connection for browser compatibility")
        if any("Secure" in r[0] and r[1] for r in results):
            print("🔒 Use secure connection for production")
        if any("TCP" in r[0] and r[1] for r in results):
            print("🔌 Direct TCP connection available")
    else:
        print("❌ MQTT broker is not accessible!")
        print()
        print("🔧 TROUBLESHOOTING:")
        print("1. Check if the broker IP is correct")
        print("2. Verify the broker is running")
        print("3. Check firewall settings")
        print("4. Verify port availability")

if __name__ == "__main__":
    main()
