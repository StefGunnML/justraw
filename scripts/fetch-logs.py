import requests
import sys

url = "https://appbuild-logs-ams3.ams3.digitaloceanspaces.com/42a7db9f-c084-4299-9e4c-45a511fa1122/630b5f79-170e-43b8-8c9b-de519c2f3bc6/a9d13fa2-a357-4bb8-a04d-70d2e501d3ce/build.log?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=2JPIHVK4OTM6S5VRFBCK%2F20260115%2Fams3%2Fs3%2Faws4_request&X-Amz-Date=20260115T085104Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=3c33e54142cef2d6864bb43848cad048e042e48046efd94f271ee41d0907fa15"

try:
    response = requests.get(url)
    print(response.text[-2000:])
except Exception as e:
    print(f"Error: {e}")
