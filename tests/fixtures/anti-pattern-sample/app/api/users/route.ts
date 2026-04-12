// Anti-pattern: params as sync object
export async function GET(
  request: Request,
  { params }: { params: { id: string } } // Anti-pattern: not Promise
) {
  // Anti-pattern: assuming this is cached (not in 15)
  const data = await fetch('https://api.example.com/users');
  return Response.json(data);
}

// Anti-pattern: mutation without revalidation
export async function POST(request: Request) {
  const body = await request.json();
  await db.user.create({ data: body });
  return Response.json({ success: true }); // No revalidation!
}
