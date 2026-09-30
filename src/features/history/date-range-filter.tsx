"use client";

import { format, isBefore } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_PRESETS, describeRange, isSameDayRange, presetRange, type DateRange } from "@/domain/date-range";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

// Preset buttons, start and end date pickers, and a summary of the range. Used by every session history view.
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const summary = describeRange(value);

  return (
    <div className="space-y-2">
      <Label>Filter by Date Range</Label>
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className={cn(
              "hover:bg-muted",
              isSameDayRange(value, presetRange(preset)) && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={() => onChange(presetRange(preset))}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <DatePicker placeholder="Start date" selected={value.from} onSelect={(from) => onChange({ ...value, from })} />
        <DatePicker
          placeholder="End date"
          selected={value.to}
          onSelect={(to) => onChange({ ...value, to })}
          disabled={(date) => (value.from ? isBefore(date, value.from) : false)}
        />
        <Button
          variant="outline"
          onClick={() => onChange({ from: undefined, to: undefined })}
          className="w-full sm:w-auto"
        >
          Reset Dates
        </Button>
      </div>

      {summary && <div className="text-sm text-muted-foreground">{summary}</div>}
    </div>
  );
}

function DatePicker({
  placeholder,
  selected,
  onSelect,
  disabled,
}: {
  placeholder: string;
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full sm:w-[240px] justify-start text-left font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} onSelect={onSelect} disabled={disabled} autoFocus />
      </PopoverContent>
    </Popover>
  );
}
