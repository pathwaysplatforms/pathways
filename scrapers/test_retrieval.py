import os
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

openai = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
supabase = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SECRET_KEY'])

query = 'I am a software engineer with 3 years experience and CLB 9 English. How do I get Canadian permanent residence?'

print(f"Query: {query}\n")

embedding = openai.embeddings.create(
    model='text-embedding-3-small',
    input=query
).data[0].embedding

results = supabase.rpc('match_immigration_chunks', {
    'query_embedding': embedding,
    'match_threshold': 0.5,
    'match_count': 5,
    'filter_country': 'canada'
}).execute()

for r in results.data:
    print(f"--- similarity: {r['similarity']:.3f} | {r['source_url']}")
    print(r['chunk_text'][:300])
    print()
