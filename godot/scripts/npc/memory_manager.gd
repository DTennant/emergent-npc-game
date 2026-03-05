extends Node
class_name MemoryManager
## Memory system for NPCs - episodic, semantic, and social memory.

var npc_id: String
var episodic_memories: Array = []
var semantic_memory: Dictionary = {}
var social_memory: Dictionary = {}

var _save_dir: String

func _init(owner_id: String):
	npc_id = owner_id
	_save_dir = "user://save/npcs/%s/" % npc_id

func _ready():
	_load_memories()

## Store an episodic memory.
func store_episodic(event: Dictionary) -> void:
	var memory = {
		"id": "mem_%d" % Time.get_ticks_msec(),
		"timestamp": "day_%d_%02d:%02d" % [WorldState.day, int(WorldState.hour), int(WorldState.minute)],
		"type": event.get("type", "interaction"),
		"participants": event.get("participants", []),
		"location": event.get("location", "unknown"),
		"summary": event.get("summary", event.get("content", "")),
		"emotional_valence": event.get("emotional_valence", 0.0),
		"importance": _score_importance(event),
		"tags": event.get("tags", []),
		"decay_rate": GameConfig.memory_decay_rate,
		"retention": 1.0,
	}
	
	episodic_memories.append(memory)
	_update_semantic(memory)
	_update_social(memory)
	_prune_if_needed()

## Retrieve relevant memories based on a query/context.
func retrieve(query: String, k: int = -1) -> Array:
	if k == -1:
		k = GameConfig.memories_per_prompt
	
	var scored = []
	for mem in episodic_memories:
		var score = _relevance_score(query, mem)
		scored.append({"memory": mem, "score": score})
	
	scored.sort_custom(func(a, b): return a.score > b.score)
	
	# Boost retention of retrieved memories (retrieval practice effect)
	for i in range(min(k, scored.size())):
		scored[i].memory.retention = min(1.0, scored[i].memory.retention + GameConfig.retrieval_boost)
	
	return scored.slice(0, k).map(func(s): return s.memory)

## Get all memories about a specific entity.
func get_memories_about(entity_id: String) -> Array:
	return episodic_memories.filter(func(m): return entity_id in m.participants)

## Get relationship state with an entity.
func get_relationship(entity_id: String) -> Dictionary:
	return social_memory.get(entity_id, _default_relationship(entity_id))

## Update relationship dimension.
func update_relationship(entity_id: String, dimension: String, delta: float) -> void:
	if not social_memory.has(entity_id):
		social_memory[entity_id] = _default_relationship(entity_id)
	
	var rel = social_memory[entity_id]
	var old_value = rel.get(dimension, 0.0)
	rel[dimension] = clamp(old_value + delta, 0.0, 1.0)
	
	EventBus.relationship_changed.emit(npc_id, entity_id, dimension, delta)

## Consolidate memories (during NPC "sleep" time).
func consolidate() -> void:
	_apply_decay()
	_summarize_old_memories()
	_extract_beliefs()
	_prune_below_threshold()

## Score memory importance based on novelty, emotion, and relevance.
func _score_importance(event: Dictionary) -> float:
	var emotion = abs(event.get("emotional_valence", 0.0))
	var novelty = 0.5  # TODO: Check if this type of event is novel
	var relevance = 0.5  # TODO: Check relevance to current goals
	return (emotion + novelty + relevance) / 3.0

## Calculate relevance score for memory retrieval.
func _relevance_score(query: String, memory: Dictionary) -> float:
	var keyword_overlap = _keyword_similarity(query, memory.summary)
	var recency = _recency_score(memory.timestamp)
	var importance = memory.importance
	var retention = memory.retention
	
	return keyword_overlap * 0.4 + recency * 0.2 + importance * 0.2 + retention * 0.2

## Simple keyword similarity (can upgrade to embeddings later).
func _keyword_similarity(query: String, text: String) -> float:
	var query_words = query.to_lower().split(" ", false)
	var text_words = text.to_lower().split(" ", false)
	var matches = 0
	for word in query_words:
		if word in text_words:
			matches += 1
	return float(matches) / max(1, query_words.size())

## Calculate recency score.
func _recency_score(timestamp: String) -> float:
	# Simple heuristic: recent memories score higher
	# TODO: Parse timestamp and calculate actual days since
	return 1.0 / (1.0 + randf() * 10)  # Placeholder

## Update semantic beliefs from episodic memory.
func _update_semantic(memory: Dictionary) -> void:
	# TODO: Pattern extraction to build general beliefs
	pass

## Update social memory from episodic memory.
func _update_social(memory: Dictionary) -> void:
	for participant in memory.participants:
		if participant == npc_id:
			continue
		
		if not social_memory.has(participant):
			social_memory[participant] = _default_relationship(participant)
		
		var rel = social_memory[participant]
		rel.interaction_count += 1
		rel.last_interaction = memory.timestamp
		
		# Update familiarity
		var familiarity_gain = 0.05 * memory.importance
		rel.familiarity = min(1.0, rel.familiarity + familiarity_gain)
		
		# Update affection based on emotional valence
		if memory.emotional_valence > 0:
			rel.affection = min(1.0, rel.affection + memory.emotional_valence * 0.1)
		elif memory.emotional_valence < 0:
			rel.affection = max(0.0, rel.affection + memory.emotional_valence * 0.1)

## Apply time-based decay to memories.
func _apply_decay() -> void:
	for memory in episodic_memories:
		memory.retention = max(0.0, memory.retention - memory.decay_rate * memory.importance)

## Summarize old memories to save space.
func _summarize_old_memories() -> void:
	# TODO: Combine similar old memories into summaries
	pass

## Extract general beliefs from patterns.
func _extract_beliefs() -> void:
	# TODO: Analyze episodic memories to form semantic beliefs
	pass

## Remove memories below retention threshold.
func _prune_below_threshold() -> void:
	episodic_memories = episodic_memories.filter(func(m): return m.retention > 0.1)

## Prune if memory count exceeds limit.
func _prune_if_needed() -> void:
	if episodic_memories.size() > GameConfig.max_episodic_memories:
		# Sort by importance * retention and keep top N
		episodic_memories.sort_custom(func(a, b): 
			return (a.importance * a.retention) > (b.importance * b.retention)
		)
		episodic_memories = episodic_memories.slice(0, GameConfig.max_episodic_memories)

func _default_relationship(entity_id: String) -> Dictionary:
	return {
		"target": entity_id,
		"familiarity": 0.0,
		"trust": 0.5,
		"affection": 0.5,
		"respect": 0.5,
		"fear": 0.0,
		"interaction_count": 0,
		"first_met": "day_%d" % WorldState.day,
		"last_interaction": "",
	}

## Save memories to disk.
func save() -> void:
	DirAccess.make_dir_recursive_absolute(_save_dir)
	
	var episodic_file = FileAccess.open(_save_dir + "episodic.json", FileAccess.WRITE)
	episodic_file.store_string(JSON.stringify(episodic_memories, "\t"))
	episodic_file.close()
	
	var social_file = FileAccess.open(_save_dir + "social.json", FileAccess.WRITE)
	social_file.store_string(JSON.stringify(social_memory, "\t"))
	social_file.close()

## Load memories from disk.
func _load_memories() -> void:
	var episodic_path = _save_dir + "episodic.json"
	if FileAccess.file_exists(episodic_path):
		var file = FileAccess.open(episodic_path, FileAccess.READ)
		var json = JSON.new()
		if json.parse(file.get_as_text()) == OK:
			episodic_memories = json.data
		file.close()
	
	var social_path = _save_dir + "social.json"
	if FileAccess.file_exists(social_path):
		var file = FileAccess.open(social_path, FileAccess.READ)
		var json = JSON.new()
		if json.parse(file.get_as_text()) == OK:
			social_memory = json.data
		file.close()
