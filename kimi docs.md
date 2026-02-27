Docs
Getting Started Guide
Use the Kimi Vision Model
Use the Kimi Vision Model
The Kimi Vision Model (including moonshot-v1-8k-vision-preview / moonshot-v1-32k-vision-preview / moonshot-v1-128k-vision-preview / kimi-k2.5 and so on) can understand visual content, including text in the image, colors, and the shapes of objects. The latest kimi-k2.5 model can also understand video content.

Using base64 to Upload Images Directly
Here is how you can ask Kimi questions about an image using the following code:

import os
import base64
 
from openai import OpenAI
 
client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.ai/v1",
)
 
# Replace kimi.png with the path to the image you want Kimi to recognize
image_path = "kimi.png"
 
with open(image_path, "rb") as f:
    image_data = f.read()
 
# We use the built-in base64.b64encode function to encode the image into a base64 formatted image_url
image_url = f"data:image/{os.path.splitext(image_path)[1]};base64,{base64.b64encode(image_data).decode('utf-8')}"
 
 
completion = client.chat.completions.create(
    model="kimi-k2.5",
    messages=[
        {"role": "system", "content": "You are Kimi."},
        {
            "role": "user",
            # Note here, the content has changed from the original str type to a list. This list contains multiple parts, with the image (image_url) being one part and the text (text) being another part.
            "content": [
                {
                    "type": "image_url", # <-- Use the image_url type to upload the image, the content is the base64 encoded image
                    "image_url": {
                        "url": image_url,
                    },
                },
                {
                    "type": "text",
                    "text": "Describe the content of the image.", # <-- Use the text type to provide text instructions, such as "Describe the content of the image"
                },
            ],
        },
    ],
)
 
print(completion.choices[0].message.content)

Note that when using the Vision model, the type of the message.content field has changed from str to List[Dict] (i.e., a JSON array). Additionally, do not serialize the JSON array and put it into message.content as a str. This will cause Kimi to fail to correctly identify the image type and may trigger the Your request exceeded model token limit error.

✅ Correct Format:

{
    "model": "kimi-k2.5",
    "messages":
    [
        {
            "role": "system",
            "content": "You are Kimi, an AI assistant provided by Moonshot AI, who excels in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will reject any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."
        },
        {
            "role": "user",
            "content":
            [
                {
                    "type": "image_url",
                    "image_url":
                    {
                        "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABhCAYAAAApxKSdAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUUSURBVHgB7Z29bhtHFIWPHQN2J7lKqnhYpYvpIukCbJEAKQJEegLReYFIT0DrCSI9QEDqCSIDaQIEIOukiJwyza5SJWlId3FFz+HuGmuSSw6p+dlZ3g84luhdUeI9M3fmziyXgBCUe/DHYY0Wj/tgWmjV42zFcWe4MIBBPNJ6qqW0uvAbXFvQgKzQK62bQhkaCIPc10q1Zi3XH1o/IG9cwUm0RogrgDY1KmLgHYX9DvyiBvDYI77XmiD+oLlQHw7hIDoCMBOt1U9w0BsU9mOAtaUUFk3oQoIfzAQFCf5dNMEdTFCQ4NtQih1NSIGgf3ibxOJt5UrAB1gNK72vIdjiI61HWr+YnNxDXK0rJiULsV65GJeiIescLSTTeobKSutiCuojX8kU3MBx4I3WeNVBBRl4fWiCyoB8v2JAAkk9PmDwT8sH1TEghRjgC27scCx41wO43KAg+ILxTvhNaUACwTc04Z0B30LwzTzm5Rjw3sgseIG1wGMawMBPIOQcqvzrNIMHOg9Q5KK953O90/rFC+BhJRH8PQZ+fu7SjC7HAIV95yu99vjlxfvBJx8nwHd6IfNJAkccOjHg6OgIs9lsra6vr2GTNE03/k7q8HAhyJ/2gM9O65/4kT7/mwEcoZwYsPQiV3BwcABb9Ho9KKU2njccDjGdLlxx+InBBPBAAR86ydRPaIC9SASi3+8bnXd+fr78nw8NJ39uDJjXAVFPP7dp/VmWLR9g6w6Huo/IOTk5MTpvZesn/93AiP/dXCwd9SyILT9Jko3n1bZ+8s8rGPGvoVHbEXcPMM39V1dX9Qd/19PPNxta959D4HUGF0RrAFs/8/8mxuPxXLUwtfx2WX+cxdivZ3DFA0SKldZPuPTAKrikbOlMOX+9zFu/Q2iAQoSY5H7mfeb/tXCT8MdneU9wNNCuQUXZA0ynnrUznyqOcrspUY4BJunHqPU3gOgMsNr6G0B0BpgUXrG0fhKVAaaF1/HxMWIhKgNMcj9Tz82Nk6rVGdav/tJ5eraJ0Wi01XPq1r/xOS8uLkJc6XYnRTMNXdf62eIvLy+jyftVghnQ7Xahe8FW59fBTRYOzosDNI1hJdz0lBQkBflkMBjMU5iL13pXRb8fYAJrB/a2db0oFHthAOEUliaYFHE+aaUBdZsvvFhApyM0idYZwOCvW4JmIWdSzPmidQaYrAGZ7iX4oFUGnJ2dGdUCTRqMozeANQCLsE6nA10JG/0Mx4KmDMbBCjEWR2yxu8LAM98vXelmCA2ovVLCI8EMYODWbpbvCXtTBzQVMSAwYkBgxIDAtNKAXWdGIRADAiMpKDA0IIMQikx6QGDEgMCIAYGRMSAsMgaEhgbcQgjFa+kBYZnIGBCWWzEgLPNBOJ6Fk/aR8Y5ZCvktKwX/PJZ7xoVjfs+4chYU11tK2sE85qUBLyH4Zh5z6QHhGPOf6r2j+TEbcgdFP2RaHX5TrYQlDflj5RXE5Q1cG/lWnhYpReUGKdUewGnRmhvnCJbgmxey8sHiZ8iwF3AsUBBckKHI/SWLq6HsBc8huML4DiK80D6WnBqLzN68UFCmopheYJOVYgcU5FOVbAVfYUcUZGoaLPglCtITdg2+tZUFBTFh2+ArWEYh/7z0WIIQSiM43lt5AWAmWhLHylN4QmkNEXfAbGqEQKsHSfHLYwiSq8AnaAAKeaW3D8VbijwNW5nh3IN9FPI/jnpaPKZi2/SfFuJu4W3x9RqWL+N5C+7ruKpBAgLkAAAAAElFTkSuQmCC"
                    }
                },
                {
                    "type": "text",
                    "text": "Please describe this image."
                }
            ]
        }
    ],
    "temperature": 0.3
}

❌ Invalid Format：

{
    "model": "kimi-k2.5",
    "messages":
    [
        {
            "role": "system",
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate responses. You will refuse to answer any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."
        },
        {
            "role": "user",
            "content": "[{\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABhCAYAAAApxKSdAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUUSURBVHgB7Z29bhtHFIWPHQN2J7lKqnhYpYvpIukCbJEAKQJEegLReYFIT0DrCSI9QEDqCSIDaQIEIOukiJwyza5SJWlId3FFz+HuGmuSSw6p+dlZ3g84luhdUeI9M3fmziyXgBCUe/DHYY0Wj/tgWmjV42zFcWe4MIBBPNJ6qqW0uvAbXFvQgKzQK62bQhkaCIPc10q1Zi3XH1o/IG9cwUm0RogrgDY1KmLgHYX9DvyiBvDYI77XmiD+oLlQHw7hIDoCMBOt1U9w0BsU9mOAtaUUFk3oQoIfzAQFCf5dNMEdTFCQ4NtQih1NSIGgf3ibxOJt5UrAB1gNK72vIdjiI61HWr+YnNxDXK0rJiULsV65GJeiIescLSTTeobKSutiCuojX8kU3MBx4I3WeNVBBRl4fWiCyoB8v2JAAkk9PmDwT8sH1TEghRjgC27scCx41wO43KAg+ILxTvhNaUACwTc04Z0B30LwzTzm5Rjw3sgseIG1wGMawMBPIOQcqvzrNIMHOg9Q5KK953O90/rFC+BhJRH8PQZ+fu7SjC7HAIV95yu99vjlxfvBJx8nwHd6IfNJAkccOjHg6OgIs9lsra6vr2GTNE03/k7q8HAhyJ/2gM9O65/4kT7/mwEcoZwYsPQiV3BwcABb9Ho9KKU2njccDjGdLlxx+InBBPBAAR86ydRPaIC9SASi3+8bnXd+fr78nw8NJ39uDJjXAVFPP7dp/VmWLR9g6w6Huo/IOTk5MTpvZesn/93AiP/dXCwd9SyILT9Jko3n1bZ+8s8rGPGvoVHbEXcPMM39V1dX9Qd/19PPNxta959D4HUGF0RrAFs/8/8mxuPxXLUwtfx2WX+cxdivZ3DFA0SKldZPuPTAKrikbOlMOX+9zFu/Q2iAQoSY5H7mfeb/tXCT8MdneU9wNNCuQUXZA0ynnrUznyqOcrspUY4BJunHqPU3gOgMsNr6G0B0BpgUXrG0fhKVAaaF1/HxMWIhKgNMcj9Tz82Nk6rVGdav/tJ5eraJ0Wi01XPq1r/xOS8uLkJc6XYnRTMNXdf62eIvLy+jyftVghnQ7Xahe8FW59fBTRYOzosDNI1hJdz0lBQkBflkMBjMU5iL13pXRb8fYAJrB/a2db0oFHthAOEUliaYFHE+aaUBdZsvvFhApyM0idYZwOCvW4JmIWdSzPmidQaYrAGZ7iX4oFUGnJ2dGdUCTRqMozeANQCLsE6nA10JG/0Mx4KmDMbBCjEWR2yxu8LAM98vXelmCA2ovVLCI8EMYODWbpbvCXtTBzQVMSAwYkBgxIDAtNKAXWdGIRADAiMpKDA0IIMQikx6QGDEgMCIAYGRMSAsMgaEhgbcQgjFa+kBYZnIGBCWWzEgLPNBOJ6Fk/aR8Y5ZCvktKwX/PJZ7xoVjfs+4chYU11tK2sE85qUBLyH4Zh5z6QHhGPOf6r2j+TEbcgdFP2RaHX5TrYQlDflj5RXE5Q1cG/lWnhYpReUGKdUewGnRmhvnCJbgmxey8sHiZ8iwF3AsUBBckKHI/SWLq6HsBc8huML4DiK80D6WnBqLzN68UFCmopheYJOVYgcU5FOVbAVfYUcUZGoaLPglCtITdg2+tZUFBTFh2+ArWEYh/7z0WIIQSiM43lt5AWAmWhLHylN4QmkNEXfAbGqEQKsHSfHLYwiSq8AnaAAKeaW3D8VbijwNW5nh3IN9FPI/jnpaPKZi2/SfFuJu4W3x9RqWL+N5C+7ruKpBAgLkAAAAAElFTkSuQmCC\"}}, {\"type\": \"text\", \"text\": \"Please describe this image\"}]"
        }
    ],
    "temperature": 0.3
}

Using Uploaded Images or Videos
In the previous example, our image_url was a base64-encoded image. Since video files are often larger, we provide an additional method where you can first upload images or videos to Moonshot, then reference them via file ID. For information on uploading images or videos, please refer to Image Understanding Upload

import os
from pathlib import Path
 
from openai import OpenAI
 
client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.cn/v1",
)
 
# Here, you need to replace video.mp4 with the path to the image or video you want Kimi to recognize
video_path = "video.mp4"
 
file_object = client.files.create(file=Path(video_path), purpose="video")  # Upload video to Moonshot
 
completion = client.chat.completions.create(
    model="kimi-k2.5",
    messages=[
        {
            "role": "system",
            "content": "You are Kimi, an AI assistant provided by Moonshot AI, who excels in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will refuse to answer any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."
        },
        {
            "role": "user",
            "content":
            [
                {
                    "type": "video_url",
                    "video_url":
                    {
                        "url": f"ms://{file_object.id}"  # Note this is ms:// instead of base64-encoded image
                    }
                },
                {
                    "type": "text",
                    "text": "Please describe this video"
                }
            ]
        }
    ]
)
 
print(completion.choices[0].message.content)

Note that in the above example, the format of video_url.url is ms://<file-id>, where ms is short for moonshot storage, which is Moonshot's internal protocol for referencing files.

Supported Formats
Images support the following formats:

png
jpeg
webp
gif
Videos support the following formats:

mp4
mpeg
mov
avi
x-flv
mpg
webm
wmv
3gpp
Token Calculation and Costs
Images and videos use dynamic token calculation. You can obtain the token consumption of a request containing images or videos through the estimate tokens API before starting the understanding process.

Generally speaking, the higher the image resolution, the more tokens it consumes. Videos are composed of several key frames. The more key frames and the higher the resolution, the more tokens are consumed.

The Vision model follows the same pricing model as the moonshot-v1 series, with costs based on the total tokens used for model inference. For more details on token pricing, please refer to:

Model Inference Pricing

Best Practices
Resolution
We recommend that image resolution does not exceed 4k (4096×2160), and video resolution does not exceed 2k (2048×1080). Resolutions higher than recommended will only cost more time processing the input without improving model understanding performance.

File Upload vs base64
Due to our overall request body size limitations, very large videos should be processed using the file upload method for visual understanding.

For images or videos that need to be referenced multiple times, we recommend using the file upload method for visual understanding.

Regarding file upload limitations, please refer to the File Upload documentation.

Features and Limitations
The Vision model supports the following features:

 Multi-turn conversations
 Streaming output
 Tool invocation
 JSON Mode
 Partial Mode
The following features are not supported or only partially supported:

URL-formatted images: Not supported, currently only supports base64-encoded image content and images/videos uploaded via file ID
Other limitations:

Image quantity: The Vision model has no limit on the number of images, but ensure that the request body size does not exceed 100M.
Parameters Differences in Request Body
Parameters are listed in chat. However, behaviour of some parameters may be different in k2.5 models.

We recommend using the default values instead of manually configuring these parameters.

Differences are listed below.

Field	Required	Description	Type	Values
max_tokens	optional	The maximum number of tokens to generate for the chat completion.	int	Default to be 32k aka 32768
thinking	optional	New! This parameter controls if the thinking is enabled for this request	object	Default to be {"type": "enabled"}. Value can only be one of {"type": "enabled"} or {"type": "disabled"}
temperature	optional	The sampling temperature to use	float	k2.5 model will use a fixed value 1.0, non-thinking mode will use a fixed value 0.6. Any other value will result in an error
top_p	optional	A sampling method	float	k2.5 model will use a fixed value 0.95. Any other value will result in an error
n	optional	The number of results to generate for each input message	int	k2.5 model will use a fixed value 1. Any other value will result in an error
presence_penalty	optional	Penalizing new tokens based on whether they appear in the text	float	k2.5 model will use a fixed value 0.0. Any other value will result in an error
frequency_penalty	optional	Penalizing new tokens based on their existing frequency in the text	float	k2.5 model will use a fixed value 0.0. Any other value will result in an error
Advanced Usages
Using vision models in Kimi Cli
Kimi Cli is an open source AI Agent by Moonshot. Kimi Cli has become more powerful with the release of K2.5 model. Kimi Agent SDK can be used in your own code, using Kimi Cli more conveniently.

A tool, that can find the source of anime from a screenshot using Kimi Agent SDK is shown as below. anime-recognizer

Last updated on January 29, 2026
When the Kimi large language model receives a question from a user, it first performs inference and then generates the response one Token at a time. In the examples from our first two chapters, we chose to wait for the Kimi large language model to generate all Tokens before printing its response. This usually takes several seconds. If your question is complex enough and the response from the Kimi large language model is long enough, the time to wait for the complete response can be stretched to 10 or even 20 seconds, which greatly reduces the user experience. To improve this situation and provide timely feedback to users, we offer the ability to stream output, known as Streaming. We will explain the principles of Streaming and illustrate it with actual code:

How to use streaming output;
Common issues when using streaming output;
How to handle streaming output without using the Python SDK;
How to Use Streaming Output
Streaming, in a nutshell, means that whenever the Kimi large language model generates a certain number of Tokens (usually 1 Token), it immediately sends these Tokens to the client, instead of waiting for all Tokens to be generated before sending them to the client. When you chat with Kimi AI Assistant, the assistant's response appears character by character, which is one manifestation of streaming output. Streaming allows users to see the first Token output by the Kimi large language model immediately, reducing wait time.

You can use streaming output in this way (stream=True) and get the streaming response:

from openai import OpenAI
 
client = OpenAI(
    api_key = "MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url = "https://api.moonshot.ai/v1",
)
 
stream = client.chat.completions.create(
    model = "kimi-k2-turbo-preview",
    messages = [
        {"role": "system", "content": "You are Kimi, an artificial intelligence assistant provided by Moonshot AI, who is better at conversing in Chinese and English. You provide users with safe, helpful, and accurate answers. At the same time, you refuse to answer any questions related to terrorism, racism, pornography, and violence. Moonshot AI is a proper noun and should not be translated into other languages."},
        {"role": "user", "content": "Hello, my name is Li Lei, what is 1+1?"}
    ],
    temperature = 0.6,
    stream=True, # <-- Note here, we enable streaming output mode by setting stream=True
)
 
# When streaming output mode is enabled (stream=True), the content returned by the SDK also changes. We no longer directly access the choice in the return value
# Instead, we access each individual chunk in the return value through a for loop
 
for chunk in stream:
	# Here, the structure of each chunk is similar to the previous completion, but the message field is replaced with the delta field
	delta = chunk.choices[0].delta # <-- The message field is replaced with the delta field
 
	if delta.content:
		# When printing the content, since it is streaming output, to ensure the coherence of the sentence, we do not add
		# line breaks manually, so we set end="" to cancel the line break of print.
		print(delta.content, end="")

Common Issues When Using Streaming Output
Now that you have successfully run the above code and understood the basic principles of streaming output, let's discuss some details and common issues of streaming output so that you can better implement your business logic.

Interface Details
When streaming output mode is enabled (stream=True), the Kimi large language model no longer returns a response in JSON format (Content-Type: application/json), but uses Content-Type: text/event-stream (abbreviated as SSE). This response format allows the server to continuously send data to the client. In the context of using the Kimi large language model, it can be understood as the server continuously sending Tokens to the client.

When you look at the HTTP response body of SSE, it looks like this:

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
 
...
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"."},"finish_reason":null}]}
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"prompt_tokens":19,"completion_tokens":13,"total_tokens":32}}]}
 
data: [DONE]

In the response body of SSE, we agree that each data chunk starts with data: , followed by a valid JSON object, and ends with two newline characters \n\n. Finally, when all data chunks have been transmitted, data: [DONE] is used to indicate that the transmission is complete, at which point the network connection can be disconnected.

Token Calculation
When using the streaming output mode, there are two ways to calculate tokens. The most straightforward and accurate method is to wait until all data chunks have been transmitted and then check the prompt_tokens, completion_tokens, and total_tokens in the usage field of the last data chunk.

...
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"prompt_tokens":19,"completion_tokens":13,"total_tokens":32}}]}
                                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                               Check the number of tokens generated by the current request through the usage field in the last data chunk
data: [DONE]

However, in practice, streaming output can be interrupted by uncontrollable factors such as network disconnections or client-side errors. In such cases, the last data chunk may not have been fully transmitted, making it impossible to know the total number of tokens consumed by the request. To avoid this issue, we recommend saving the content of each data chunk as it is received and then using the token calculation interface to compute the total consumption after the request ends, regardless of whether it was successful or not. Here is an example code snippet:

import os
import httpx
from openai import OpenAI
 
client = OpenAI(
    api_key = "MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url = "https://api.moonshot.ai/v1",
)
 
stream = client.chat.completions.create(
    model = "kimi-k2-turbo-preview",
    messages = [
        {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI, who excels in Chinese and English conversations. You provide users with safe, helpful, and accurate answers while rejecting any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."},
        {"role": "user", "content": "Hello, my name is Li Lei. What is 1+1?"}
    ],
    temperature = 0.6,
    stream=True, # <-- Note here, we enable streaming output mode by setting stream=True
)
 
 
def estimate_token_count(input: str) -> int:
    """
    Implement your token calculation logic here, or directly call our token calculation interface to compute tokens.
 
    https://api.moonshot.ai/v1/tokenizers/estimate-token-count
    """
    header = {
        "Authorization": f"Bearer {os.environ['MOONSHOT_API_KEY']}",
    }
    data = {
        "model": "kimi-k2-turbo-preview",
        "messages": [
            {"role": "user", "content": input},
        ]
    }
    r = httpx.post("https://api.moonshot.ai/v1/tokenizers/estimate-token-count", headers=header, json=data)
    r.raise_for_status()
    return r.json()["data"]["total_tokens"]
 
 
completion = []
for chunk in stream:
	delta = chunk.choices[0].delta
	if delta.content:
		completion.append(delta.content)
 
 
print("completion_tokens:", estimate_token_count("".join(completion)))

How to Terminate Output
If you want to stop the streaming output, you can simply close the HTTP connection or discard any subsequent data chunks. For example:

for chunk in stream:
	if condition:
		break

How to Handle Streaming Output Without Using an SDK
If you prefer not to use the Python SDK to handle streaming output and instead want to directly interface with HTTP APIs to use the Kimi large language model (for example, in cases where you are using a language without an SDK, or you have unique business logic that the SDK cannot meet), we provide some examples to help you understand how to properly handle the SSE response body in HTTP (we still use Python code as an example here, with detailed explanations provided in comments).

import httpx # We use the httpx library to make our HTTP requests
 
 
data = {
	"model": "kimi-k2-turbo-preview",
	"messages": [
		# Specific messages
	],
	"temperature": 0.6,
	"stream": True,
}
 
 
# Use httpx to send a chat request to the Kimi large language model and get the response r
r = httpx.post("https://api.moonshot.ai/v1/chat/completions", json=data)
if r.status_code != 200:
	raise Exception(r.text)
 
 
data: str
 
# Here, we use the iter_lines method to read the response body line by line
for line in r.iter_lines():
	# Remove leading and trailing spaces from each line to better handle data chunks
	line = line.strip()
 
	# Next, we need to handle three different cases:
	#   1. If the current line is empty, it indicates that the previous data chunk has been received (as mentioned earlier, the data chunk transmission ends with two newline characters), we can deserialize the data chunk and print the corresponding content;
	#   2. If the current line is not empty and starts with data:, it indicates the start of a data chunk transmission, we remove the data: prefix and first check if it is the end symbol [DONE], if not, save the data content to the data variable;
	#   3. If the current line is not empty but does not start with data:, it indicates that the current line still belongs to the previous data chunk being transmitted, we append the content of the current line to the end of the data variable;
 
	if len(line) == 0:
		chunk = json.loads(data)
 
		# The processing logic here can be replaced with your business logic, printing is just to demonstrate the process
		choice = chunk["choices"][0]
		usage = choice.get("usage")
		if usage:
			print("total_tokens:", usage["total_tokens"])
		delta = choice["delta"]
		role = delta.get("role")
		if role:
			print("role:", role)
		content = delta.get("content")
		if content:
			print(content, end="")
 
		data = "" # Reset data
	elif line.startswith("data: "):
		data = line.lstrip("data: ")
 
		# When the data chunk content is [DONE], it indicates that all data chunks have been sent, and the network connection can be disconnected
		if data == "[DONE]":
			break
	else:
		data = data + "\n" + line # We still add a newline character when appending content, as this data chunk may intentionally format the data in separate lines

The above is the process of handling streaming output using Python as an example. If you are using other languages, you can also properly handle the content of streaming output. The basic steps are as follows:

Initiate an HTTP request and set the stream parameter in the request body to true;
Receive the response from the server. Note that if the Content-Type in the response Headers is text/event-stream, it indicates that the response content is a streaming output;
Read the response content line by line and parse the data chunks (the data chunks are presented in JSON format). Pay attention to determining the start and end positions of the data chunks through the data: prefix and newline character \n;
Determine whether the transmission is complete by checking if the current data chunk content is [DONE];
Note: Always use data: [DONE] to determine if the data has been fully transmitted, rather than using finish_reason or other methods. If you do not receive the data: [DONE] message chunk, even if you have obtained the information finish_reason=stop, you should not consider the data chunk transmission as complete. In other words, until you receive the data: [DONE] data chunk, the message should be considered incomplete.

During the streaming output process, only the content field is streamed, meaning each data chunk contains a portion of the content tokens. For fields that do not need to be streamed, such as role and usage, we usually present them all at once in the first or last data chunk, rather than including the role and usage fields in every data chunk (specifically, the role field will only appear in the first data chunk and will not be included in subsequent data chunks; the usage field will only appear in the last data chunk and will not be included in the preceding data chunks).

Handling n>1
Sometimes, we want to get multiple results to choose from. To do this, you should set the n parameter in the request to a value greater than 1. When it comes to stream output, we also support the use of n>1. In such cases, we need to add some extra code to determine the index value of the current data block, to figure out which response the data block belongs to. Let's illustrate this with example code:

import httpx # We use the httpx library to make our HTTP requests
 
 
data = {
	"model": "kimi-k2-turbo-preview",
	"messages": [
		# Specific messages go here
	],
	"temperature": 0.6,
	"stream": True,
	"n": 2, # <-- Note here, we're asking the Kimi large language model to output 2 responses
}
 
 
# Use httpx to send a chat request to the Kimi large language model and get the response r
r = httpx.post("https://api.moonshot.ai/v1/chat/completions", json=data)
if r.status_code != 200:
	raise Exception(r.text)
 
 
data: str
 
# Here, we pre-build a List to store different response messages. Since we set n=2, we initialize the List with 2 elements
messages = [{}, {}]
 
# We use the iter_lines method here to read the response body line by line
for line in r.iter_lines():
	# Remove leading and trailing spaces from each line to better handle data blocks
	line = line.strip()
 
	# Next, we need to handle three different scenarios:
	#   1. If the current line is empty, it indicates that the previous data block has been fully received (as mentioned earlier, data block transmission ends with two newline characters). We can deserialize this data block and print out the corresponding content;
	#   2. If the current line is not empty and starts with data:, it means the start of a data block transmission. After removing the data: prefix, we first check if it's the end marker [DONE]. If not, we save the data content to the data variable;
	#   3. If the current line is not empty but doesn't start with data:, it means this line still belongs to the previous data block being transmitted. We append the content of this line to the end of the data variable;
 
	if len(line) == 0:
		chunk = json.loads(data)
 
		# Loop through all choices in each data block to get the message object corresponding to the index
		for choice in chunk["choices"]:
			index = choice["index"]
			message = messages[index]
			usage = choice.get("usage")
			if usage:
				message["usage"] = usage
			delta = choice["delta"]
			role = delta.get("role")
			if role:
				message["role"] = role
			content = delta.get("content")
			if content:
				message["content"] = message.get("content", "") + content
 
			data = "" # Reset data
	elif line.startswith("data: "):
		data = line.lstrip("data: ")
 
		# When the data block content is [DONE], it means all data blocks have been sent and we can disconnect the network
		if data == "[DONE]":
			break
	else:
		data = data + "\n" + line # When we're still appending content, we add a newline character because this might be the data block's intentional way of displaying data on separate lines
 
 
# After assembling all messages, we print their contents separately
for index, message in enumerate(messages):
	print("index:", index)
	print("message:", json.dumps(message, ensure_ascii=False))

When n>1, the key to handling stream output is to first determine which response message the current data block belongs to based on its index value, and then proceed with further logical processing.

Docs
API Reference
Chat
Basic Information
Public Service Address
https://api.moonshot.ai

Moonshot offers API services based on HTTP, and for most APIs, we are compatible with the OpenAI SDK.

Quickstart
Single-turn chat
The official OpenAI SDK supports Python and Node.js. Below are examples of how to interact with the API using OpenAI SDK and Curl:

curl https://api.moonshot.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d '{
        "model": "kimi-k2-turbo-preview",
        "messages": [
            {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will reject any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."},
            {"role": "user", "content": "Hello, my name is Li Lei. What is 1+1?"}
        ],
        "temperature": 0.6
   }'

Replace $MOONSHOT_API_KEY with the API Key you created on the platform.

When running the code in the documentation using the OpenAI SDK, ensure that your Python version is at least 3.7.1, your Node.js version is at least 18, and your OpenAI SDK version is no lower than 1.0.0.

pip install --upgrade 'openai>=1.0'

You can easily check the version of your library like this:

python -c 'import openai; print("version =",openai.__version__)'
# The output might be version = 1.10.0, indicating that the current python is using the v1.10.0 library of openai

Multi-turn chat
In the single-turn chat example above, the language model takes a list of user messages as input and returns the generated response as output. Sometimes, we can also use the model's output as part of the input to achieve multi-turn chat. Below is a simple example of implementing multi-turn chat:

from openai import OpenAI
 
client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)
 
history = [
    {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will reject any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."}
]
 
def chat(query, history):
    history.append({
        "role": "user", 
        "content": query
    })
    completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=history,
        temperature=0.6,
    )
    result = completion.choices[0].message.content
    history.append({
        "role": "assistant",
        "content": result
    })
    return result
 
print(chat("What is the rotation period of the Earth?", history))
print(chat("What about the Moon?", history))

It is worth noting that as the chat progresses, the number of tokens the model needs to process will increase linearly. When necessary, some optimization strategies should be employed, such as retaining only the most recent few rounds of chat.

API Documentation
Chat Completion
Request URL
POST https://api.moonshot.ai/v1/chat/completions

Request
Example
{
    "model": "kimi-k2-turbo-preview",
    "messages": [
        {
            "role": "system",
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You aim to provide users with safe, helpful, and accurate responses. You will refuse to answer any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."
        },
        { "role": "user", "content": "Hello, my name is Li Lei. What is 1+1?" }
    ],
    "temperature": 0.6
}

Request body
Field	Required	Description	Type	Values
messages	required	A list of messages that have been exchanged in the conversation so far	List[Dict]	This is a list of structured elements, each similar to: {"role": "user", "content": "Hello"} The role can only be one of system, user, assistant, and the content must not be empty. See Content Field Description for detailed information about the content field formats
model	required	Model ID, which can be obtained through List Models	string	Currently one of kimi-k2.5,kimi-k2-0905-preview, kimi-k2-0711-preview, kimi-k2-turbo-preview, kimi-k2-thinking-turbo, kimi-k2-thinking, moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k, moonshot-v1-auto,moonshot-v1-8k-vision-preview,moonshot-v1-32k-vision-preview,moonshot-v1-128k-vision-preview
max_tokens	optional	Deprecated, please refer to max_completion_tokens	int	-
max_completion_tokens	optional	The maximum number of tokens to generate for the chat completion. If the result reaches the maximum number of tokens without ending, the finish reason will be "length"; otherwise, it will be "stop"	int	It is recommended to provide a reasonable value as needed. If not provided, we will use a good default integer like 1024. Note: This max_completion_tokens refers to the length of the tokens you expect us to return, not the total length of input plus output. For example, for a moonshot-v1-8k model, the maximum total length of input plus output is 8192. When the total length of the input messages is 4096, you can set this to a maximum of 4096; otherwise, our service will return an invalid input parameter (invalid_request_error) and refuse to respond. If you want to know the "exact number of input tokens," you can use the "Token Calculation" API below to get the count using our calculator
temperature	optional	The sampling temperature to use, ranging from 0 to 1. A higher value (e.g., 0.7) will make the output more random, while a lower value (e.g., 0.2) will make it more focused and deterministic	float	Default is 0.0 for moonshot-v1 series models, 0.6 for kimi-k2 models and 1.0 for kimi-k2-thinking models. This parameter cannot be modified for the kimi-k2.5 model.
top_p	optional	Another sampling method, where the model considers the results of tokens with a cumulative probability mass of top_p. Thus, 0.1 means only considering the top 10% of tokens by probability mass. Generally, we suggest changing either this or the temperature, but not both at the same time	float	Default is 1.0 for moonshot-v1 series and kimi-k2 models, 0.95 for kimi-k2.5 model. This parameter cannot be modified for the k2.5 model.
n	optional	The number of results to generate for each input message	int	Default is 1 for moonshot-v1 series and kimi-k2 models, and it must not exceed 5. Specifically, when the temperature is very close to 0, we can only return one result. If n is set and > 1 in this case, our service will return an invalid input parameter (invalid_request_error). Default is 1 for kimi-k2.5 model and it cannot be modified.
presence_penalty	optional	Presence penalty, a number between -2.0 and 2.0. A positive value will penalize new tokens based on whether they appear in the text, increasing the likelihood of the model discussing new topics	float	Default is 0. This parameter cannot be modified for the kimi-k2.5 model.
frequency_penalty	optional	Frequency penalty, a number between -2.0 and 2.0. A positive value will penalize new tokens based on their existing frequency in the text, reducing the likelihood of the model repeating the same phrases verbatim	float	Default is 0. This parameter cannot be modified for the kimi-k2.5 model.
response_format	optional	Setting this to {"type": "json_object"} enables JSON mode, ensuring that the generated information is valid JSON. When you set response_format to {"type": "json_object"}, you must explicitly guide the model to output JSON-formatted content in the prompt and specify the exact format of the JSON, otherwise it may result in unexpected outcomes.	object	Default is {"type": "text"}
stop	optional	Stop words, which will halt the output when a full match is found. The matched words themselves will not be output. A maximum of 5 strings is allowed, and each string must not exceed 32 bytes	String, List[String]	Default is null
thinking	optional	Only available for kimi-k2.5 model. This parameter controls if the thinking is enabled for this request	object	Default to be {"type": "enabled"}. Value can only be one of {"type": "enabled"} or {"type": "disabled"}
stream	optional	Whether to return the response in a streaming fashion	bool	Default is false, and true is an option
stream_options.include_usage	optional	If set, an additional chunk will be streamed before the data: [DONE] message. The usage field on this chunk shows the token usage statistics for the entire request, and the choices field will always be an empty array. All other chunks will also include a usage field, but with a null value. NOTE: If the stream is interrupted, you may not receive the final usage chunk which contains the total token usage for the request	bool	Default is false
prompt_cache_key	optional	Used to cache responses for similar requests to optimize cache hit rates	string	Default is null. For Coding Agents, this is typically a session id or task id representing a single session; if the session is exited and later resumed, this value should remain the same. For Kimi Code Plan, this field is required to improve cache hit rates. For other agents involving multi-turn conversations, it is also recommended to implement this field
safety_identifier	optional	A stable identifier used to help detect users of your application that may be violating usage policies. The ID should be a string that uniquely identifies each user. It is recommended to hash the username or email address to avoid sending any identifying information	string	Default is null
Content Field Description
The content field in the message can have different types of values:

plain text, just string
List[Dict] when you need to pass more complex information and each dict can have following fields:
type field is always necessary and is used to identify type of content. Its value should be one of text, image_url or video_url.
text field is necessary whentype is text. Its value should be plain text.
image_url field is necessary when type is image_url. Its value should be a dict indicating content of image like {"url": "data:image/png;base64,abc123xxxxx==}
video_url field is necessary when type is video_url. Its value should be a dict indicating content of videl like {"url": "data:video/mp4;base64,def456yyyyy==}
The following are all valid content field examples:

"Hello"
[{"type": "text", "text": "Hello"}]
[{"type": "image_url", "image_url": {"url": "data:image/png;base64,abc123xxxxx=="}}]
[{"type": "video_url", "video_url": {"url": "data:video/mp4;base64,def456yyyyy=="}}]
[{"type": "text", "text": "这是什么？"}, {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc123xxxxx=="}}]
Note that url field of image_url and video_url can be base64 format or ms://<file_id>. Please refer to Use the Kimi Vision Model for detail.

Return
For non-streaming responses, the return format is similar to the following:

{
    "id": "cmpl-04ea926191a14749b7f2c7a48a68abc6",
    "object": "chat.completion",
    "created": 1698999496,
    "model": "kimi-k2-turbo-preview",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Hello, Li Lei! 1+1 equals 2. If you have any other questions, feel free to ask!"
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 19,
        "completion_tokens": 21,
        "total_tokens": 40,
        "cached_tokens": 10  # The number of tokens hit by the cache, only models that support automatic caching will return this field
    }
}

For streaming responses, the return format is similar to the following:

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
 
...
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"."},"finish_reason":null}]}
 
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"prompt_tokens":19,"completion_tokens":13,"total_tokens":32}}]}
 
data: [DONE]

Example Request
For simple calls, refer to the previous example. For streaming calls, you can refer to the following code snippet:

curl https://api.moonshot.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -d '{
    "model": "kimi-k2-turbo-preview",
    "messages": [
      {
        "role": "system",
        "content": "You are Kimi, an AI assistant provided by Moonshot AI. You excel at conversing in Chinese and English. You provide users with safe, helpful, and accurate responses. You refuse to answer any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."
      },
      {
        "role": "user",
        "content": "Hello, my name is Li Lei. What is 1+1?"
      }
    ],
    "stream": true
  }'

Vision
Example
{
    "model": "moonshot-v1-8k-vision-preview",
    "messages":
    [
        {
            "role": "system",
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in both Chinese and English conversations. You aim to provide users with safe, helpful, and accurate answers. You will refuse to answer any questions related to terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into any other language."
        },
        {
            "role": "user",
            "content":
            [
                {
                    "type": "image_url",
                    "image_url":
                    {
                        "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABhCAYAAAApxKSdAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUUSURBVHgB7Z29bhtHFIWPHQN2J7lKqnhYpYvpIukCbJEAKQJEegLReYFIT0DrCSI9QEDqCSIDaQIEIOukiJwyza5SJWlId3FFz+HuGmuSSw6p+dlZ3g84luhdUeI9M3fmziyXgBCUe/DHYY0Wj/tgWmjV42zFcWe4MIBBPNJ6qqW0uvAbXFvQgKzQK62bQhkaCIPc10q1Zi3XH1o/IG9cwUm0RogrgDY1KmLgHYX9DvyiBvDYI77XmiD+oLlQHw7hIDoCMBOt1U9w0BsU9mOAtaUUFk3oQoIfzAQFCf5dNMEdTFCQ4NtQih1NSIGgf3ibxOJt5UrAB1gNK72vIdjiI61HWr+YnNxDXK0rJiULsV65GJeiIescLSTTeobKSutiCuojX8kU3MBx4I3WeNVBBRl4fWiCyoB8v2JAAkk9PmDwT8sH1TEghRjgC27scCx41wO43KAg+ILxTvhNaUACwTc04Z0B30LwzTzm5Rjw3sgseIG1wGMawMBPIOQcqvzrNIMHOg9Q5KK953O90/rFC+BhJRH8PQZ+fu7SjC7HAIV95yu99vjlxfvBJx8nwHd6IfNJAkccOjHg6OgIs9lsra6vr2GTNE03/k7q8HAhyJ/2gM9O65/4kT7/mwEcoZwYsPQiV3BwcABb9Ho9KKU2njccDjGdLlxx+InBBPBAAR86ydRPaIC9SASi3+8bnXd+fr78nw8NJ39uDJjXAVFPP7dp/VmWLR9g6w6Huo/IOTk5MTpvZesn/93AiP/dXCwd9SyILT9Jko3n1bZ+8s8rGPGvoVHbEXcPMM39V1dX9Qd/19PPNxta959D4HUGF0RrAFs/8/8mxuPxXLUwtfx2WX+cxdivZ3DFA0SKldZPuPTAKrikbOlMOX+9zFu/Q2iAQoSY5H7mfeb/tXCT8MdneU9wNNCuQUXZA0ynnrUznyqOcrspUY4BJunHqPU3gOgMsNr6G0B0BpgUXrG0fhKVAaaF1/HxMWIhKgNMcj9Tz82Nk6rVGdav/tJ5eraJ0Wi01XPq1r/xOS8uLkJc6XYnRTMNXdf62eIvLy+jyftVghnQ7Xahe8FW59fBTRYOzosDNI1hJdz0lBQkBflkMBjMU5iL13pXRb8fYAJrB/a2db0oFHthAOEUliaYFHE+aaUBdZsvvFhApyM0idYZwOCvW4JmIWdSzPmidQaYrAGZ7iX4oFUGnJ2dGdUCTRqMozeANQCLsE6nA10JG/0Mx4KmDMbBCjEWR2yxu8LAM98vXelmCA2ovVLCI8EMYODWbpbvCXtTBzQVMSAwYkBgxIDAtNKAXWdGIRADAiMpKDA0IIMQikx6QGDEgMCIAYGRMSAsMgaEhgbcQgjFa+kBYZnIGBCWWzEgLPNBOJ6Fk/aR8Y5ZCvktKwX/PJZ7xoVjfs+4chYU11tK2sE85qUBLyH4Zh5z6QHhGPOf6r2j+TEbcgdFP2RaHX5TrYQlDflj5RXE5Q1cG/lWnhYpReUGKdUewGnRmhvnCJbgmxey8sHiZ8iwF3AsUBBckKHI/SWLq6HsBc8huML4DiK80D6WnBqLzN68UFCmopheYJOVYgcU5FOVbAVfYUcUZGoaLPglCtITdg2+tZUFBTFh2+ArWEYh/7z0WIIQSiM43lt5AWAmWhLHylN4QmkNEXfAbGqEQKsHSfHLYwiSq8AnaAAKeaW3D8VbijwNW5nh3IN9FPI/jnpaPKZi2/SfFuJu4W3x9RqWL+N5C+7ruKpBAgLkAAAAAElFTkSuQmCC"
                    }
                },
                {
                    "type": "text",
                    "text": "Please describe this image."
                }
            ]
        }
    ],
    "temperature": 0.6
}

Image Content Field Description
When using the Vision model, the message.content field will change from str to List[Object[str, any]]. Each element in the List has the following fields:

Parameter Name	Required	Description	Type
type	required	Supports only text type (text) or image type (image_url)	string
image_url	required	Object for transmitting the image	Dict[str, any]
The fields for the image_url parameter are as follows:

Parameter Name	Required	Description	Type
url	required	Image content encoded in base64 or identified by file id	string
Example Request
import os
import base64
 
from openai import OpenAI
 
client = OpenAI(
    api_key = os.environ.get("MOONSHOT_API_KEY"), 
    base_url = "https://api.moonshot.ai/v1",
)
 
# Encode the image in base64
with open("your_image_path", 'rb') as f:
    img_base = base64.b64encode(f.read()).decode('utf-8')
 
response = client.chat.completions.create(
    model="moonshot-v1-8k-vision-preview", 
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{img_base}"
                    }
                },
                {
                    "type": "text",
                    "text": "Please describe this image."
                }
            ]
        }
    ]
)
print(response.choices[0].message.content)

List Models
Request URL
GET https://api.moonshot.ai/v1/models

Example request
curl https://api.moonshot.ai/v1/models -H "Authorization: Bearer $MOONSHOT_API_KEY"

Error Explanation
Here are some examples of error responses:

{
    "error": {
        "type": "content_filter",
        "message": "The request was rejected because it was considered high risk"
    }
}

Below are explanations for the main errors:

HTTP Status Code	error type	error message	Detailed Description
400	content_filter	The request was rejected because it was considered high risk	Content review rejection, your input or generated content may contain unsafe or sensitive information. Please avoid prompts that could generate sensitive content. Thank you.
400	invalid_request_error	Invalid request: {error_details}	Invalid request, usually due to incorrect request format or missing necessary parameters. Please check and retry.
400	invalid_request_error	Input token length too long	The length of tokens in the request is too long. Do not exceed the model's maximum token limit.
400	invalid_request_error	Your request exceeded model token limit : {max_model_length}	The sum of the tokens in the request and the set max_tokens exceeds the model's specification length. Please check the request body's specifications or choose a model with an appropriate length.
400	invalid_request_error	Invalid purpose: only 'file-extract' accepted	The purpose (purpose) in the request is incorrect. Currently, only 'file-extract' is accepted. Please modify and retry.
400	invalid_request_error	File size is too large, max file size is 100MB, please confirm and re-upload the file	The uploaded file size exceeds the limit. Please re-upload.
400	invalid_request_error	File size is zero, please confirm and re-upload the file	The uploaded file size is 0. Please re-upload.
400	invalid_request_error	The number of files you have uploaded exceeded the max file count {max_file_count}, please delete previous uploaded files	The total number of uploaded files exceeds the limit. Please delete unnecessary earlier files and re-upload.
401	invalid_authentication_error	Invalid Authentication	Authentication failed. Please check if the apikey is correct and retry.
401	incorrect_api_key_error	Incorrect API key provided	Authentication failed. Please check if the apikey is provided and correct, then retry.
429	exceeded_current_quota_error	Your account {organization-id}<{ak-id}> is suspended, please check your plan and billing details	Account balance is insufficient. Please check your account balance.
403	permission_denied_error	The API you are accessing is not open	The API you are trying to access is not currently open.
403	permission_denied_error	You are not allowed to get other user info	Accessing other users' information is not permitted. Please check.
404	resource_not_found_error	Not found the model {model-id} or Permission denied	The model does not exist or you do not have permission to access it. Please check and retry.
429	engine_overloaded_error	The engine is currently overloaded, please try again later	There are currently too many concurrent requests, and the node is rate-limited. Please retry later. It is recommended to upgrade your tier for a smoother experience.
429	exceeded_current_quota_error	You exceeded your current token quota: <{organization_id}> {token_credit}, please check your account balance	Your account balance is insufficient. Please check your account balance and ensure it can cover the cost of your token consumption before retrying.
429	rate_limit_reached_error	Your account {organization-id}<{ak-id}> request reached organization max concurrency: {Concurrency}, please try again after {time} seconds	Your request has reached the account's concurrency limit. Please wait for the specified time before retrying.
429	rate_limit_reached_error	Your account {organization-id}<{ak-id}> request reached organization max RPM: {RPM}, please try again after {time} seconds	Your request has reached the account's RPM rate limit. Please wait for the specified time before retrying.
429	rate_limit_reached_error	Your account {organization-id}<{ak-id}> request reached organization TPM rate limit, current:{current_tpm}, limit:{max_tpm}	Your request has reached the account's TPM rate limit. Please wait for the specified time before retrying.
429	rate_limit_reached_error	Your account {organization-id}<{ak-id}> request reached organization TPD rate limit,current:{current_tpd}, limit:{max_tpd}	Your request has reached the account's TPD rate limit. Please wait for the specified time before retrying.
500	server_error	Failed to extract file: {error}	Failed to parse the file. Please retry.
500	unexpected_output	invalid state transition	Internal error. Please contact the administrator.
Last updated on February 9, 20npm install @moonshot-ai/kimi-agent-sdk zod
# or
pnpm add @moonshot-ai/kimi-agent-sdk zodQuick Start
import { createSession } from '@moonshot-ai/kimi-agent-sdk';

const session = createSession({
  workDir: '/path/to/project',
  model: 'kimi-latest',
  thinking: true,
});

const turn = session.prompt('Explain this codebase');

for await (const event of turn) {
  if (event.type === 'ContentPart' && event.payload.type === 'text') {
    process.stdout.write(event.payload.text);
  }
}

await session.close();
API Reference
Session Management
createSession(options: SessionOptions): Session
Creates a new session instance.

interface SessionOptions {
  workDir: string;           // Working directory path
  sessionId?: string;        // Optional session ID (auto-generated if omitted)
  model?: string;            // Model identifier
  thinking?: boolean;        // Enable thinking mode
  yoloMode?: boolean;        // Auto-approve all tool calls
  executable?: string;       // Path to CLI executable (default: "kimi")
  env?: Record<string, string>; // Environment variables
}
Session
interface Session {
  readonly sessionId: string;
  readonly workDir: string;
  readonly state: SessionState;  // 'idle' | 'active' | 'closed'
  
  // Configurable properties
  model: string | undefined;
  thinking: boolean;
  yoloMode: boolean;
  executable: string;
  env: Record<string, string>;
  
  // Methods
  prompt(content: string | ContentPart[]): Turn;
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}
Turn
Represents an ongoing conversation turn.

interface Turn {
  [Symbol.asyncIterator](): AsyncIterator<StreamEvent, RunResult, undefined>;
  interrupt(): Promise<void>;
  approve(requestId: string, response: ApprovalResponse): Promise<void>;
  readonly result: Promise<RunResult>;
}
prompt(content, options): Promise<{ result, events }>
One-shot prompt helper for simple use cases.

import { prompt } from '@moonshot-ai/kimi-agent-sdk';

const { result, events } = await prompt('What does this code do?', {
  workDir: '/path/to/project',
  model: 'kimi-latest',
});
Stream Events
Events emitted during a turn:

Event Type	Payload	Description
TurnBegin	{ user_input }	Turn started
StepBegin	{ n }	New step started
StepInterrupted	{}	Step was interrupted
ContentPart	ContentPart	Text or thinking content
ToolCall	ToolCall	Tool invocation started
ToolCallPart	{ arguments_part }	Streaming tool arguments
ToolResult	ToolResult	Tool execution result
SubagentEvent	SubagentEvent	Nested agent event
StatusUpdate	StatusUpdate	Token usage and context info
CompactionBegin	{}	Context compaction started
CompactionEnd	{}	Context compaction finished
ApprovalRequest	ApprovalRequestPayload	Tool needs approval
Content Types
ContentPart
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'think'; think: string; encrypted?: string | null }
  | { type: 'image_url'; image_url: { url: string; id?: string | null } }
  | { type: 'audio_url'; audio_url: { url: string; id?: string | null } }
  | { type: 'video_url'; video_url: { url: string; id?: string | null } };
ToolCall
interface ToolCall {
  type: 'function';
  id: string;
  function: {
    name: string;
    arguments: string | null;
  };
  extras?: Record<string, unknown> | null;
}
ToolResult
interface ToolResult {
  tool_call_id: string;
  return_value: {
    is_error: boolean;
    output: string | ContentPart[];
    message: string;
    display: DisplayBlock[];
    extras?: Record<string, unknown> | null;
  };
}
DisplayBlock
type DisplayBlock =
  | { type: 'brief'; text: string }
  | { type: 'diff'; path: string; old_text: string; new_text: string }
  | { type: 'todo'; items: Array<{ title: string; status: 'pending' | 'in_progress' | 'done' }> }
  | { type: string; data: Record<string, unknown> };  // Unknown block
RunResult
interface RunResult {
  status: 'finished' | 'cancelled' | 'max_steps_reached';
  steps?: number;
}
ApprovalResponse
type ApprovalResponse = 'approve' | 'approve_for_session' | 'reject';
Session Storage
listSessions(workDir: string): Promise<SessionInfo[]>
Lists all sessions for a workspace.

interface SessionInfo {
  id: string;
  workDir: string;
  contextFile: string;
  updatedAt: number;   // Timestamp in milliseconds
  brief: string;       // First user message preview
}
deleteSession(workDir: string, sessionId: string): Promise<boolean>
Deletes a session. Returns true if successful.

parseSessionEvents(workDir: string, sessionId: string): Promise<StreamEvent[]>
Parses and returns all events from a session's history.

Configuration
parseConfig(): KimiConfig
Reads and parses the CLI configuration file.

interface KimiConfig {
  defaultModel: string | null;
  defaultThinking: boolean;
  models: ModelConfig[];
}

interface ModelConfig {
  id: string;
  name: string;
  capabilities: string[];  // 'thinking' | 'always_thinking' | 'image_in' | 'video_in'
}
saveDefaultModel(modelId: string, thinking?: boolean): void
Updates the default model in the configuration file.

getModelById(models: ModelConfig[], modelId: string): ModelConfig | undefined
Finds a model by ID.

getModelThinkingMode(model: ModelConfig): ThinkingMode
Returns the thinking mode for a model.

type ThinkingMode = 'none' | 'switch' | 'always';
isModelThinking(models: ModelConfig[], modelId: string): boolean
Checks if a model supports thinking.

MCP Server Management
authMCP(serverName: string, executable?: string): Promise<void>
Initiates OAuth authentication for an MCP server.

resetAuthMCP(serverName: string, executable?: string): Promise<void>
Resets authentication for an MCP server.

testMCP(serverName: string, executable?: string): Promise<MCPTestResult>
Tests connection to an MCP server.

interface MCPTestResult {
  success: boolean;
  message?: string;
  tools?: string[];
  error?: string;
}
MCPServerConfig
interface MCPServerConfig {
  name: string;
  transport: 'http' | 'stdio';
  url?: string;              // For HTTP transport
  command?: string;          // For stdio transport
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  auth?: 'oauth';
}
File Paths
KimiPaths
Utility object for Kimi CLI file paths.

const KimiPaths = {
  home: string;                                    // ~/.kimi
  config: string;                                  // ~/.kimi/config.toml
  mcpConfig: string;                               // ~/.kimi/mcp.json
  sessionsDir(workDir: string): string;            // Session storage directory
  sessionDir(workDir: string, sessionId: string): string;
  shadowGitDir(workDir: string, sessionId: string): string;
};
Error Handling
All errors extend AgentSdkError:

abstract class AgentSdkError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;
}

type ErrorCategory = 'transport' | 'protocol' | 'session' | 'cli';
Error Classes
Class	Category	Codes
TransportError	transport	SPAWN_FAILED, STDIN_NOT_WRITABLE, PROCESS_CRASHED, CLI_NOT_FOUND, ALREADY_STARTED, HANDSHAKE_TIMEOUT
ProtocolError	protocol	INVALID_JSON, SCHEMA_MISMATCH, UNKNOWN_EVENT_TYPE, UNKNOWN_REQUEST_TYPE, REQUEST_TIMEOUT, REQUEST_CANCELLED
SessionError	session	SESSION_CLOSED, SESSION_BUSY, TURN_INTERRUPTED, APPROVAL_FAILED
CliError	cli	INVALID_STATE, LLM_NOT_SET, LLM_NOT_SUPPORTED, CHAT_PROVIDER_ERROR, UNKNOWN
Error Utilities
// Check if error is from this SDK
isAgentSdkError(err: unknown): err is AgentSdkError

// Get error code (returns 'UNKNOWN' for non-SDK errors)
getErrorCode(err: unknown): string

// Get error category (returns 'unknown' for non-SDK errors)
getErrorCategory(err: unknown): ErrorCategory | 'unknown'
Utility Functions
extractBrief(display?: DisplayBlock[]): string
Extracts brief text from display blocks.

extractTextFromContentParts(parts: ContentPart[]): string
Extracts all text content from content parts.

formatContentOutput(output: string | ContentPart[]): string
Formats content output as a string.

Usage Examples
Creating External Tools
import { z } from 'zod';
import { createExternalTool, createSession } from '@moonshot-ai/kimi-agent-sdk';

// Define your custom tool with zod schema
const weatherTool = createExternalTool({
  name: 'get_weather',
  description: 'Get weather information for a city',
  parameters: z.object({
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  handler: async (params) => {
    // Your tool logic here
    const weather = await fetchWeather(params.city, params.unit);
    return {
      output: `Weather in ${params.city}: ${weather.temp}°`,
      message: 'Weather fetched successfully',
    };
  },
});

// Use the tool in a session
const session = createSession({
  workDir: process.cwd(),
  externalTools: [weatherTool],
});

const turn = session.prompt('What is the weather in Beijing?');
for await (const event of turn) {
  if (event.type === 'ContentPart' && event.payload.type === 'text') {
    console.log(event.payload.text);
  }
}
Note: Works with both zod v3 and v4. The SDK will use your project's zod version.

Handling Tool Approvals
const turn = session.prompt('Delete all .tmp files');

for await (const event of turn) {
  if (event.type === 'ApprovalRequest') {
    const { id, action, description } = event.payload;
    console.log(`Approval needed: ${action} - ${description}`);
    
    // Approve or reject
    await turn.approve(id, 'approve');
  }
}
Streaming with Token Usage
for await (const event of turn) {
  if (event.type === 'StatusUpdate') {
    const { token_usage, context_usage } = event.payload;
    if (token_usage) {
      console.log(`Tokens: ${token_usage.input_other} in, ${token_usage.output} out`);
    }
  }
}
Handling Subagent Events
for await (const event of turn) {
  if (event.type === 'SubagentEvent') {
    const { task_tool_call_id, event: subEvent } = event.payload;
    console.log(`Subagent ${task_tool_call_id}: ${subEvent.type}`);
  }
}
Interrupting a Turn
const turn = session.prompt('Long running task...');

// Interrupt after 10 seconds
setTimeout(() => turn.interrupt(), 10000);

for await (const event of turn) {
  // Handle events until interrupted
}

const result = await turn.result;
console.log(result.status);  // 'cancelled'
Multi-turn Conversation with Image Input
import { createSession, type ContentPart } from '@moonshot-ai/kimi-agent-sdk';

async function analyzeImage() {
  const session = createSession({
    workDir: process.cwd(),
    model: 'kimi-vision',
    thinking: true,
  });

  // First turn: send image with question
  const imageContent: ContentPart[] = [
    { type: 'text', text: 'What is shown in this image?' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo...' } },
  ];

  const turn1 = session.prompt(imageContent);
  for await (const event of turn1) {
    if (event.type === 'ContentPart' && event.payload.type === 'text') {
      process.stdout.write(event.payload.text);
    }
  }

  // Second turn: follow-up question (session maintains context)
  const turn2 = session.prompt('Can you identify any potential issues?');
  for await (const event of turn2) {
    if (event.type === 'ContentPart' && event.payload.type === 'text') {
      process.stdout.write(event.payload.text);
    }
  }

  await session.close();
}
Resuming a Previous Session
import { 
  createSession, 
  listSessions, 
  parseSessionEvents,
  type StreamEvent 
} from '@moonshot-ai/kimi-agent-sdk';

async function resumeSession(workDir: string) {
  // List existing sessions
  const sessions = await listSessions(workDir);
  
  if (sessions.length === 0) {
    console.log('No previous sessions found');
    return;
  }

  // Get the most recent session
  const latestSession = sessions[0];
  console.log(`Resuming session: ${latestSession.brief}`);

  // Load session history
  const history = await parseSessionEvents(workDir, latestSession.id);
  
  // Display previous messages
  for (const event of history) {
    if (event.type === 'TurnBegin') {
      const input = event.payload.user_input;
      const text = typeof input === 'string' 
        ? input 
        : input.filter(p => p.type === 'text').map(p => p.text).join('\n');
      console.log(`\nUser: ${text}`);
    }
    if (event.type === 'ContentPart' && event.payload.type === 'text') {
      process.stdout.write(event.payload.text);
    }
  }

  // Create session with existing ID to continue conversation
  const session = createSession({
    workDir,
    sessionId: latestSession.id,
    model: 'kimi-latest',
  });

  // Continue the conversation
  const turn = session.prompt('Please continue from where we left off');
  for await (const event of turn) {
    if (event.type === 'ContentPart' && event.payload.type === 'text') {
      process.stdout.write(event.payload.text);
    }
  }

  await session.close();
}