extends Node
## GameConfig - Global configuration singleton.

# LLM Settings
var llm_api_url: String = "https://api.openai.com/v1/chat/completions"
var llm_model: String = "gpt-4o-mini"
var llm_api_key: String = ""
var llm_temperature: float = 0.8
var llm_max_tokens: int = 500

# Game Settings
var npc_interaction_range: float = 64.0
var player_speed: float = 150.0
var npc_speed: float = 80.0

# Memory Settings
var max_episodic_memories: int = 200
var max_semantic_beliefs: int = 50
var memory_decay_rate: float = 0.01
var retrieval_boost: float = 0.1
var memories_per_prompt: int = 5

# Debug
var debug_mode: bool = false
var show_npc_thoughts: bool = false
var log_llm_calls: bool = true

func _ready():
	_load_api_key()
	_load_config()

func _load_api_key() -> void:
	# Try environment variable first
	llm_api_key = OS.get_environment("OPENAI_API_KEY")
	if llm_api_key.is_empty():
		# Try config file
		var path = OS.get_user_data_dir() + "/api_key.txt"
		if FileAccess.file_exists(path):
			var file = FileAccess.open(path, FileAccess.READ)
			llm_api_key = file.get_as_text().strip_edges()
			file.close()
	if llm_api_key.is_empty():
		push_warning("No LLM API key found. Set OPENAI_API_KEY or create api_key.txt in user data dir.")

func _load_config() -> void:
	var path = OS.get_user_data_dir() + "/config.json"
	if FileAccess.file_exists(path):
		var file = FileAccess.open(path, FileAccess.READ)
		var json = JSON.new()
		if json.parse(file.get_as_text()) == OK:
			var data = json.data
			llm_api_url = data.get("llm_api_url", llm_api_url)
			llm_model = data.get("llm_model", llm_model)
			llm_temperature = data.get("llm_temperature", llm_temperature)
			debug_mode = data.get("debug_mode", debug_mode)
		file.close()
