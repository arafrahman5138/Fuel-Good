from langchain_core.messages import HumanMessage, SystemMessage
from app.agents.llm_provider import get_llm

SYSTEM_PROMPT = """You are a friendly cooking assistant at Fuel Good. Help users through recipes step by step.
Respond in plain conversational text only. Do NOT use asterisks, hashtags, bullet dashes, headers, or any markdown formatting whatsoever. Do not write bold text, numbered lists with markdown, or any special symbols for formatting. Write in natural flowing sentences as if speaking to someone standing in the kitchen.
Provide clear instructions, tips for success, common mistakes to avoid, and timing guidance. Keep responses concise and encouraging. If the user asks about substitutions or modifications, suggest whole-food alternatives."""


async def get_cooking_help(recipe: dict, step_number: int, question: str = "") -> str:
    llm = get_llm()
    steps = recipe.get("steps", [])
    current_step = steps[step_number] if step_number < len(steps) else "Final step"

    user_msg = f"""Recipe: {recipe.get('title', 'Unknown')}
Current step ({step_number + 1}/{len(steps)}): {current_step}
Ingredients: {', '.join(i.get('name', '') for i in recipe.get('ingredients', []))}

{"User question: " + question if question else "Please provide guidance for this step."}"""

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ]

    response = await llm.ainvoke(messages)
    return response.content
