"""演示数据库种子脚本

一次性往 cyclebubble_demo.db 写入预置数据：
- demo 账号（demo@cyclebubble.local / 密码：demo）：承载演示模式的主时间线记忆
- 独立作者账号（demo.author@cyclebubble.local）：承载共鸣 feed 的公开故事
- 5 条种子记忆（demo 账号，不同时间段、不同主题）
- 3 条共鸣故事（作者账号，公开；demo 账号登录时能在 feed 看到）
- 3 条示例经期（demo 账号，让 cycle status 有内容）

共鸣 feed 用独立作者账号的原因：
  resonance/feed 会排除"当前用户自己"的公开记忆。
  若故事全由 demo 账号发布，demo 自己登录后将看不到任何共鸣故事。

使用方法：
  python -m backend.seed_demo           # 写入
  python -m backend.seed_demo --reset    # 清空后重新写入
"""
import sys
import json
import argparse
from datetime import datetime, date, timedelta
from sqlmodel import Session, select, delete

from .database import init_db, demo_engine
from .models import User, Memory, Cycle, Response
from .auth import hash_password


DEMO_EMAIL = "demo@cyclebubble.local"
DEMO_NICKNAME = "演示用户"


SEED_MEMORIES = [
    {
        "raw_text": "今天又因为领导的一句话纠结了一整天。我是不是太敏感了？",
        "themes": ["自我", "工作"],
        "triggers": ["评价"],
        "recovery": ["独处"],
        "mood": "焦虑",
        "is_public": True,
        "days_ago": 90,
        "snippet_override": "今天又因为领导的一句话纠结了一整天……",
    },
    {
        "raw_text": "和朋友聊了之后好多了。原来不只是我一个人这样。",
        "themes": ["关系"],
        "triggers": [],
        "recovery": ["连接"],
        "mood": "平静",
        "is_public": False,
        "days_ago": 60,
    },
    {
        "raw_text": "开会时又想反驳但没说出口。下次想试着表达出来。",
        "themes": ["工作", "表达"],
        "triggers": ["冲突"],
        "recovery": [],
        "mood": "焦虑",
        "is_public": False,
        "days_ago": 42,
    },
    {
        "raw_text": "今天终于主动说出了自己的想法，虽然说出口时手在抖。",
        "themes": ["工作", "表达"],
        "triggers": ["冲突"],
        "recovery": ["表达"],
        "mood": "力量",
        "is_public": True,
        "days_ago": 30,
    },
    {
        "raw_text": "这个阶段又到了，提前做好了心理准备。没有像上次那样陷入很久。",
        "themes": ["身体", "自我"],
        "triggers": ["周期"],
        "recovery": ["独处"],
        "mood": "平静",
        "is_public": False,
        "days_ago": 14,
    },
]


# demo 共鸣流作者（独立账号）：演示模式下 demo 账号登录后浏览共鸣流，
# 因 resonance/feed 排除了"自己的"公开记忆，若故事全由 demo 账号发布，
# demo 自己将看不到任何共鸣故事。因此用独立作者承载公开故事。
DEMO_AUTHOR_EMAIL = "demo.author@cyclebubble.local"
DEMO_AUTHOR_NICKNAME = "一位相似经历的人"


# 共鸣 feed 故事（公开）。这些由独立作者账号发布，
# demo 账号登录浏览时能看到（因为作者 ≠ 当前 demo 账号）。
SEED_FEED_STORIES = [
    {
        "raw_text": "以前总觉得是自己太敏感了。后来发现，每一次'太敏感'之后，我都学会了一点新的照顾自己的方式。那些方式加在一起，就是成长。",
        "themes": ["自我"],
        "mood": "力量",
        "days_ago": 7,
    },
    {
        "raw_text": "今天和朋友说她也是这样，她找到的方法是写下来，我也想试试看。",
        "themes": ["关系"],
        "mood": "平静",
        "days_ago": 12,
    },
    {
        "raw_text": "这个月又开始反复想那件事了，好像每个月都会有一周是这样……",
        "themes": ["自我"],
        "mood": "难过",
        "days_ago": 18,
    },
]


def reset_demo_data(session: Session) -> None:
    """清空 demo 库的所有数据（除 demo 账号本身）"""
    # 外键约束开启，先删子表再删主表
    session.exec(delete(Response))
    session.exec(delete(Memory))
    session.exec(delete(Cycle))
    session.commit()


def get_or_create_demo_user(session: Session) -> User:
    user = session.exec(select(User).where(User.email == DEMO_EMAIL)).first()
    if user:
        return user
    user = User(
        email=DEMO_EMAIL,
        nickname=DEMO_NICKNAME,
        password_hash=hash_password("demo"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_or_create_demo_author(session: Session) -> User:
    """独立作者账号，承载共鸣 feed 的公开故事。"""
    user = session.exec(select(User).where(User.email == DEMO_AUTHOR_EMAIL)).first()
    if user:
        return user
    user = User(
        email=DEMO_AUTHOR_EMAIL,
        nickname=DEMO_AUTHOR_NICKNAME,
        # 作者账号不用于登录，仅承载公开记忆；仍设密码以满足 NOT NULL
        password_hash=hash_password("demo-author-not-for-login"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def seed_memories(session: Session, demo_user: User) -> int:
    """写入 demo 账号的主时间线记忆。按 raw_text 去重，重复执行不重复写入。"""
    existing_texts = {
        m.raw_text for m in session.exec(select(Memory).where(Memory.user_id == demo_user.id)).all()
    }
    count = 0
    for spec in SEED_MEMORIES:
        if spec["raw_text"] in existing_texts:
            continue
        m = Memory(
            user_id=demo_user.id,
            raw_text=spec["raw_text"],
            themes=json.dumps(spec.get("themes", []), ensure_ascii=False),
            triggers=json.dumps(spec.get("triggers", []), ensure_ascii=False),
            recovery=json.dumps(spec.get("recovery", []), ensure_ascii=False),
            emotions=json.dumps([], ensure_ascii=False),
            mood=spec.get("mood", ""),
            is_public=spec.get("is_public", False),
            created_at=datetime.utcnow() - timedelta(days=spec["days_ago"]),
        )
        session.add(m)
        existing_texts.add(spec["raw_text"])
        count += 1
    session.commit()
    return count


def seed_feed_stories(session: Session, author: User) -> int:
    """创建共鸣 feed 的公开故事（由独立作者账号发布，供 demo 账号浏览）。

    按 raw_text 去重：重复执行（不带 --reset）不会重复写入相同的公开故事，
    以确保 seed_responses 拿到的 feed_index 始终对应同一组 memory。
    """
    existing_texts = {
        m.raw_text for m in session.exec(select(Memory).where(Memory.user_id == author.id)).all()
    }
    count = 0
    for spec in SEED_FEED_STORIES:
        if spec["raw_text"] in existing_texts:
            continue
        m = Memory(
            user_id=author.id,
            raw_text=spec["raw_text"],
            themes=json.dumps(spec.get("themes", []), ensure_ascii=False),
            triggers=json.dumps([], ensure_ascii=False),
            recovery=json.dumps([], ensure_ascii=False),
            emotions=json.dumps([], ensure_ascii=False),
            mood=spec.get("mood", ""),
            is_public=True,
            created_at=datetime.utcnow() - timedelta(days=spec["days_ago"]),
        )
        session.add(m)
        existing_texts.add(spec["raw_text"])
        count += 1
    session.commit()
    return count


def seed_cycle(session: Session, demo_user: User) -> int:
    """写入示例周期：3 条经期（28 天间隔）。按 source='seed' + start_date 去重。"""
    today = date.today()
    starts = [today - timedelta(days=14 + i * 28) for i in range(3)]
    existing_dates = {
        c.start_date for c in session.exec(
            select(Cycle).where(Cycle.user_id == demo_user.id, Cycle.source == "seed")
        ).all()
    }
    count = 0
    for start in starts:
        if start in existing_dates:
            continue
        c = Cycle(
            user_id=demo_user.id,
            start_date=start,
            end_date=start + timedelta(days=5),
            flow="medium",
            source="seed",
            created_at=datetime.utcnow(),
        )
        session.add(c)
        existing_dates.add(start)
        count += 1
    session.commit()
    return count


# 演示回应样例：
# 全部由 demo 账号发出（demo 是当前登录账号），目标是让 feed 故事看起来
# 已经被回应过；这与真实用户无关——真实用户只读真实库，演示库的内容
# 不会泄漏到真实数据库。
SEED_RESPONSES = [
    {
        "feed_index": 0,
        "type": "我也经历过",
        "content": None,
        "days_ago": 4,
    },
    {
        "feed_index": 0,
        "type": "抱抱",
        "content": "你现在已经走到了这一步，已经很不容易了。",
        "days_ago": 3,
    },
    {
        "feed_index": 1,
        "type": "谢谢你的分享",
        "content": None,
        "days_ago": 8,
    },
    {
        "feed_index": 1,
        "type": "分享我的经历",
        "content": "我也试过写下来，第一周很难，后来发现真的能慢下来一点。",
        "days_ago": 6,
    },
    {
        "feed_index": 2,
        "type": "我也经历过",
        "content": None,
        "days_ago": 2,
    },
]


def seed_responses(session: Session, demo_user: User, author: User, *, reset: bool = False) -> int:
    """给共鸣 feed 的公开故事补几条 demo 账号的回应。

    - 仅作用于演示库 (demo_engine)，不会触碰真实库。
    - reset 模式：写入前清空 demo 账号对作者故事的回应，全量写入。
    - 非 reset 模式：按 (feed_index, type) 语义去重，重复执行不会重复写入。
    - demo 账号不能回应自己的记忆，所以这里回应作者账号的公开故事。
    """
    feed_memories = session.exec(
        select(Memory)
        .where(Memory.user_id == author.id, Memory.is_public == True)
        .order_by(Memory.created_at)
    ).all()
    if not feed_memories:
        return 0

    if reset:
        feed_ids = [m.id for m in feed_memories]
        session.exec(
            delete(Response).where(
                Response.user_id == demo_user.id,
                Response.memory_id.in_(feed_ids),
            )
        )
        session.commit()

    index_to_memory = {i: mem for i, mem in enumerate(feed_memories)}
    existing_pairs = set()
    if not reset:
        feed_ids = {m.id for m in feed_memories}
        index_by_id = {mem.id: i for i, mem in index_to_memory.items()}
        for r in session.exec(select(Response)).all():
            if r.user_id != demo_user.id or r.memory_id not in feed_ids:
                continue
            existing_pairs.add((index_by_id[r.memory_id], r.type))

    count = 0
    for spec in SEED_RESPONSES:
        idx = spec.get("feed_index", 0)
        if idx not in index_to_memory:
            continue
        key = (idx, spec["type"])
        if key in existing_pairs:
            continue
        memory = index_to_memory[idx]
        resp = Response(
            memory_id=memory.id,
            user_id=demo_user.id,
            type=spec["type"],
            content=spec.get("content"),
            created_at=datetime.utcnow() - timedelta(days=spec.get("days_ago", 0)),
        )
        session.add(resp)
        existing_pairs.add(key)
        count += 1
    if count:
        session.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description="CycleBubble 演示库种子脚本")
    parser.add_argument("--reset", action="store_true", help="先清空再写入")
    args = parser.parse_args()

    print("=" * 60)
    print(" CycleBubble 演示库种子")
    print("=" * 60)

    # 1. 初始化 demo 库
    print("\n[1/4] 初始化演示库 ...")
    init_db(target="demo")

    # 2. 创建 demo 账号 + 独立作者账号
    print("[2/5] 创建 demo 账号 + 共鸣作者账号 ...")
    with Session(demo_engine) as session:
        demo_user = get_or_create_demo_user(session)
        author = get_or_create_demo_author(session)
        print(f"       demo 账号: {demo_user.email} (id={demo_user.id})")
        print(f"       作者账号: {author.email} (id={author.id})")

        if args.reset:
            print("\n[*] 重置模式：清空演示数据 ...")
            reset_demo_data(session)

        # 3. 写种子记忆（demo 账号的主时间线）
        print("\n[3/5] 写入种子记忆 ...")
        n_mem = seed_memories(session, demo_user)
        print(f"       主时间线: {n_mem} 条")

        # 4. 写 feed 故事（独立作者账号的公开记忆）+ 周期
        print("\n[4/5] 写入共鸣 feed + 示例周期 ...")
        n_feed = seed_feed_stories(session, author)
        n_cycle = seed_cycle(session, demo_user)
        print(f"       共鸣故事: {n_feed} 条")
        print(f"       经期数据: {n_cycle} 条")

        # 5. 写 demo 账号对共鸣故事的回应（让 feed 更真实）
        print("\n[5/5] 写入 demo 回应 ...")
        n_resp = seed_responses(session, demo_user, author, reset=args.reset)
        print(f"       演示回应: {n_resp} 条")

    print("\n" + "=" * 60)
    print(" 演示数据初始化完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
