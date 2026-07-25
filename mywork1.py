# 실행방법 : uv run langgraph dev

import os
from typing import TypedDict

from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI
from langchain_community.callbacks.manager import get_openai_callback
from langgraph.graph import StateGraph, START, END

load_dotenv(override=True)

SYSTEM_PROMPT = "당신은 친절하고 명확하게 답변하는 AI 어시스턴트입니다."


class GraphState(TypedDict, total=False):
    prompt: str
    model_name: str
    answer: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_cost_usd: float


def generate(state: GraphState) -> GraphState:
    model_name = state.get("model_name") or os.getenv("OPENAI_DEFAULT_MODEL", "gpt-4o-mini")

    llm = ChatOpenAI(model=model_name, temperature=0)
    prompt_template = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("human", "{prompt}")]
    )
    chain = RunnablePassthrough() | prompt_template | llm | StrOutputParser()

    with get_openai_callback() as cb:
        answer = chain.invoke({"prompt": state["prompt"]})

    return {
        "model_name": model_name,
        "answer": answer,
        "prompt_tokens": cb.prompt_tokens,
        "completion_tokens": cb.completion_tokens,
        "total_tokens": cb.total_tokens,
        "total_cost_usd": cb.total_cost,
    }


workflow = StateGraph(GraphState)
workflow.add_node("generate", generate)
workflow.add_edge(START, "generate")
workflow.add_edge("generate", END)

graph = workflow.compile()  # langgraph.json 이 이 변수를 가리킵니다.


if __name__ == "__main__":
    # langgraph dev 없이 로컬에서 바로 확인하고 싶을 때
    question = {"prompt": "보험금을 받기 위해 제출해야 하는 서류는 무엇이야?", "model_name": "gpt-4o-mini"}
    response = graph.invoke(question)
    print(response)