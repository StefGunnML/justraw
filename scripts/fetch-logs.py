import requests
import sys

url = "https://appbuild-logs-ams3.ams3.digitaloceanspaces.com/42a7db9f-c084-4299-9e4c-45a511fa1122/97b716cc-ab6c-4b4d-8ebc-14a3fa97d930/70e0bf96-b38c-47c6-aa32-951ee3d0a846/build.log?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=2JPIHVK4OTM6S5VRFBCK%2F20260115%2Fams3%2Fs3%2Faws4_request&X-Amz-Date=20260115T083648Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=7bd535209e13dcbf5e10b2c3edf38c41950520035fc17f29ee9d59d5de1c0a96"

try:
    response = requests.get(url)
    print(response.text[-2000:])
except Exception as e:
    print(f"Error: {e}")
