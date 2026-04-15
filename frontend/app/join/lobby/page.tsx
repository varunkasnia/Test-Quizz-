import { redirect } from 'next/navigation'

export default function JoinLobbyRedirect({
  searchParams,
}: {
  searchParams: { pin?: string }
}) {
  const pin = (searchParams?.pin || '').toUpperCase()
  const target = pin ? `/join/game?pin=${encodeURIComponent(pin)}` : '/join'
  redirect(target)
}
