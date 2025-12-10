import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value, ...props }, ref) => (
  <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)} {...props}>
    <div style={{ width: `${value ?? 0}%` }} className="h-full flex-1 bg-primary transition-all" />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
