import { getDriverImage, getDriverInitials } from "@/data/images";
import type { Driver, Team } from "@/data/types";
import { cn } from "@/lib/utils";
import { RemoteImage } from "./remote-image";

export function DriverPortrait({
  driver,
  team,
  className,
}: {
  driver: Driver;
  team: Team;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border-2",
        className,
      )}
      style={{ borderColor: team.color, background: `${team.color}33` }}
    >
      <RemoteImage
        src={getDriverImage(driver, team)}
        alt={`${driver.firstName} ${driver.lastName}`}
        className="absolute inset-0 size-full object-cover object-top"
        fallback={
          <span className="absolute inset-0 grid place-items-center font-bold">
            {getDriverInitials(driver)}
          </span>
        }
      />
    </div>
  );
}
