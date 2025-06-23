import {
  Phone,
  Assessment,
  Monitor,
  History,
  Analytics,
} from '@mui/icons-material';
import { SvgIconComponent } from '@mui/icons-material';

export interface SideBarLink {
  name: string;
  link: string;
  icon: SvgIconComponent;
}

export const sideBarLinks: SideBarLink[] = [
  {
    name: "Call Dashboard",
    link: "/dashboard/calls",
    icon: Phone,
  },
  {
    name: "Live Monitor",
    link: "/dashboard/monitor",
    icon: Monitor,
  },
  {
    name: "Interview Results",
    link: "/dashboard/results",
    icon: Analytics,
  },
  {
    name: "Call History",
    link: "/dashboard/history",
    icon: History,
  }
];