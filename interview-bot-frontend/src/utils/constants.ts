import {
  Phone,
  Assessment,
  Monitor,
  History,
  Analytics,
  PictureAsPdf,
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
  },
  {
    name: "Bulk PDF Processor",
    link: "/bulk-pdf-processor",
    icon: PictureAsPdf,
  }
];