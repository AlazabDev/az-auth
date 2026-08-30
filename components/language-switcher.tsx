"use client"

import { useState } from "react"
import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const [arabic, setArabic] = useState(true)

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 rounded-xl border-border/70 bg-card/70 font-medium"
      onClick={() => setArabic((value) => !value)}
      aria-label={arabic ? "Switch to English" : "التبديل إلى العربية"}
    >
      <Languages className="size-4" />
      {arabic ? "EN" : "عربي"}
    </Button>
  )
}
