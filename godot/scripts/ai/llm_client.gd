extends Node
class_name LLMClient
## LLM API client for NPC dialogue and decision making.

signal response_received(response: Dictionary)
signal request_failed(error: String)

var _http_request: HTTPRequest
var _pending_callbacks: Array = []
var _is_requesting: bool = false
var _request_queue: Array = []

func _ready():
	_http_request = HTTPRequest.new()
	_http_request.timeout = 30.0
	add_child(_http_request)
	_http_request.request_completed.connect(_on_request_completed)

## Send a chat completion request to the LLM API.
func chat(messages: Array, callback: Callable, model_override: String = "") -> void:
	var request = {
		"messages": messages,
		"callback": callback,
		"model": model_override if not model_override.is_empty() else GameConfig.llm_model,
	}
	_request_queue.append(request)
	_process_queue()

func _process_queue() -> void:
	if _is_requesting or _request_queue.is_empty():
		return
	
	_is_requesting = true
	var request = _request_queue.pop_front()
	_pending_callbacks.append(request.callback)
	
	var body = {
		"model": request.model,
		"messages": request.messages,
		"temperature": GameConfig.llm_temperature,
		"max_tokens": GameConfig.llm_max_tokens,
		"response_format": {"type": "json_object"},
	}
	
	var headers = [
		"Content-Type: application/json",
		"Authorization: Bearer " + GameConfig.llm_api_key,
	]
	
	var json_body = JSON.stringify(body)
	
	if GameConfig.log_llm_calls:
		print("[LLM] Requesting %s with %d messages" % [request.model, request.messages.size()])
	
	var error = _http_request.request(
		GameConfig.llm_api_url,
		headers,
		HTTPClient.METHOD_POST,
		json_body
	)
	
	if error != OK:
		_is_requesting = false
		var cb = _pending_callbacks.pop_back()
		cb.call({"error": "HTTP request failed: %s" % error})
		_process_queue()

func _on_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	_is_requesting = false
	var callback = _pending_callbacks.pop_front() if not _pending_callbacks.is_empty() else null
	
	if result != HTTPRequest.RESULT_SUCCESS:
		if callback:
			callback.call({"error": "Request failed with result: %d" % result})
		_process_queue()
		return
	
	if response_code != 200:
		var error_text = body.get_string_from_utf8()
		push_error("[LLM] API error %d: %s" % [response_code, error_text])
		if callback:
			callback.call({"error": "API error %d" % response_code})
		_process_queue()
		return
	
	var json = JSON.new()
	var parse_result = json.parse(body.get_string_from_utf8())
	if parse_result != OK:
		if callback:
			callback.call({"error": "Failed to parse response JSON"})
		_process_queue()
		return
	
	var data = json.data
	var content_str = data.choices[0].message.content
	
	# Parse the JSON content from the LLM response
	var content_json = JSON.new()
	var content_parse = content_json.parse(content_str)
	
	var response: Dictionary
	if content_parse == OK:
		response = content_json.data
	else:
		# If not valid JSON, wrap in a simple dict
		response = {"dialogue": content_str, "raw": true}
	
	if GameConfig.log_llm_calls:
		print("[LLM] Response received: %s" % content_str.substr(0, 100))
	
	if callback:
		callback.call(response)
	
	response_received.emit(response)
	_process_queue()
