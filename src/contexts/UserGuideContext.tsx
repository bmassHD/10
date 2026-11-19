import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserGuideTopic, TourStep } from '../types';

export const USER_GUIDE_TOPICS: UserGuideTopic[] = [
  {
    id: 'bhyt_lookup_guide',
    title: 'Tra cứu thông tin BHYT & Lịch sử KCB',
    description: 'Hướng dẫn từng bước cách nhập mã thẻ BHYT, kiểm tra hạn mức quyền lợi và xem lịch sử khám chữa bệnh.',
    badge: 'Phổ biến',
    iconName: 'CreditCard',
    category: 'citizen',
    targetTab: 'bhyt_lookup',
    steps: [
      {
        id: 'bhyt_step_1',
        targetTourId: 'tour-bhyt-input',
        title: 'Bước 1: Nhập mã thẻ BHYT hoặc CCCD',
        instruction: 'Hãy thử nhấp vào ô nhập liệu này và gõ thử mã thẻ BHYT (ví dụ: GD479... hoặc số CCCD 12 số) để tiếp tục.',
        actionType: 'input',
        expectedInputPlaceholder: 'Nhập mã thẻ BHYT...',
        position: 'bottom',
      },
      {
        id: 'bhyt_step_2',
        targetTourId: 'tour-bhyt-search-btn',
        title: 'Bước 2: Bấm nút Tra Cứu',
        instruction: 'Bây giờ hãy thử bấm vào nút "Tra cứu BHYT" để hệ thống gửi yêu cầu kiểm tra dữ liệu.',
        actionType: 'click',
        position: 'top',
      },
    ],
  },
  {
    id: 'duty_schedule_guide',
    title: 'Xem Lịch trực 24/7 & Danh bạ Lãnh đạo',
    description: 'Cách tra cứu ca trực y tế hôm nay, danh sách bác sĩ trực đêm và số điện thoại cấp cứu tuyến trên.',
    badge: 'Khẩn cấp',
    iconName: 'CalendarClock',
    category: 'medical',
    targetTab: 'duty',
    steps: [
      {
        id: 'duty_step_1',
        targetTourId: 'tour-duty-tab-daily',
        title: 'Bước 1: Chọn Chế độ Lịch Trực',
        instruction: 'Thử bấm vào tab "Lịch Trực Hôm Nay" để xem danh sách cán bộ đang trực 24/7 tại trạm.',
        actionType: 'click',
        position: 'bottom',
      },
      {
        id: 'duty_step_2',
        targetTourId: 'tour-duty-emergency-btn',
        title: 'Bước 2: Đường dây Cấp cứu Tuyến trên',
        instruction: 'Thử chạm vào nút Cấp cứu 24/7 để xem số điện thoại và tên bệnh viện tiếp nhận cấp cứu.',
        actionType: 'click',
        position: 'top',
      },
    ],
  },
  {
    id: 'vaccination_guide',
    title: 'Tra cứu Lịch Tiêm chủng Mở rộng',
    description: 'Xem các đợt tiêm vắc xin cho trẻ em và phụ nữ mang thai, địa điểm tiêm chính và các điểm phụ khu phố.',
    badge: 'Y tế cơ sở',
    iconName: 'Syringe',
    category: 'citizen',
    targetTab: 'vaccination',
    steps: [
      {
        id: 'vax_step_1',
        targetTourId: 'tour-vax-program-filter',
        title: 'Bước 1: Chọn Chương trình Tiêm',
        instruction: 'Thử bấm vào phân loại "Tiêm chủng mở rộng" để xem các đợt tiêm định kỳ miễn phí.',
        actionType: 'click',
        position: 'bottom',
      },
      {
        id: 'vax_step_2',
        targetTourId: 'tour-vax-search',
        title: 'Bước 2: Tìm kiếm theo loại Vắc xin',
        instruction: 'Thử nhập tên vắc xin (ví dụ: Lao, Sởi, 5 trong 1) vào ô tìm kiếm này.',
        actionType: 'input',
        position: 'bottom',
      },
    ],
  },
  {
    id: 'documents_guide',
    title: 'Tra cứu & Đọc Văn bản Y tế với Agent',
    description: 'Cách tìm kiếm nhanh văn bản chỉ đạo điều hành, tải biểu mẫu và sử dụng Agent AI để tự động tóm tắt.',
    badge: 'Hành chính',
    iconName: 'FileText',
    category: 'medical',
    targetTab: 'documents',
    steps: [
      {
        id: 'doc_step_1',
        targetTourId: 'tour-doc-search-input',
        title: 'Bước 1: Nhập từ khóa văn bản',
        instruction: 'Thử gõ một từ khóa (ví dụ: "tiêm chủng", "BHYT", "phòng chống dịch") vào thanh tìm kiếm.',
        actionType: 'input',
        position: 'bottom',
      },
      {
        id: 'doc_step_2',
        targetTourId: 'tour-doc-filter-btn',
        title: 'Bước 2: Lọc theo Cơ quan Ban hành',
        instruction: 'Thử bấm vào bộ lọc thể loại hoặc cơ quan ban hành để thu hẹp kết quả tìm kiếm.',
        actionType: 'click',
        position: 'bottom',
      },
    ],
  },
  {
    id: 'feedback_guide',
    title: 'Gửi Ý kiến Phản ánh & Kiến nghị',
    description: 'Quy trình gửi ý kiến đóng góp về chất lượng dịch vụ, thủ tục BHYT và nhận mã tra cứu tiến độ xử lý.',
    badge: 'Dân cử',
    iconName: 'MessageSquare',
    category: 'citizen',
    targetTab: 'feedback_tracking',
    steps: [
      {
        id: 'fb_step_1',
        targetTourId: 'tour-feedback-new-btn',
        title: 'Bước 1: Bấm nút Gửi Phản Ánh',
        instruction: 'Hãy thử bấm vào nút "Gửi Phản Ánh Mới" để mở phiếu tiếp nhận ý kiến nhân dân.',
        actionType: 'click',
        position: 'top',
      },
      {
        id: 'fb_step_2',
        targetTourId: 'tour-feedback-search-input',
        title: 'Bước 2: Tra cứu tiến độ đã gửi',
        instruction: 'Thử nhập mã hồ sơ phản ánh (vd: PA-...) vào ô này để kiểm tra kết quả xử lý của trạm.',
        actionType: 'input',
        position: 'bottom',
      },
    ],
  },
  {
    id: 'apps_launcher_guide',
    title: 'Sử dụng Kho Ứng dụng & Mục Yêu thích',
    description: 'Cách mở các ứng dụng y tế như Bác sĩ cho mọi nhà, VssID, Dịch vụ công và lưu vào mục yêu thích tiện dụng.',
    badge: 'Tiện ích',
    iconName: 'LayoutGrid',
    category: 'citizen',
    targetTab: 'apps',
    steps: [
      {
        id: 'app_step_1',
        targetTourId: 'tour-apps-cat-filter',
        title: 'Bước 1: Lọc Danh mục Ứng dụng',
        instruction: 'Thử bấm chọn một danh mục như "Dịch vụ công" hoặc "Y tế" để xem các ứng dụng chuyên ngành.',
        actionType: 'click',
        position: 'bottom',
      },
      {
        id: 'app_step_2',
        targetTourId: 'tour-apps-first-item',
        title: 'Bước 2: Thêm vào Mục Yêu Thích',
        instruction: 'Thử bấm vào biểu tượng ngôi sao trên ứng dụng để ghim lên đầu danh sách.',
        actionType: 'click',
        position: 'top',
      },
    ],
  },
  {
    id: 'offline_emergency_guide',
    title: 'Trang Cấp cứu Ngoại tuyến (100% Offline SOS)',
    description: 'Cách lưu và mở trang cấp cứu ngoại tuyến khi mất sóng điện thoại, không có WiFi/5G.',
    badge: 'Quan trọng',
    iconName: 'ShieldAlert',
    category: 'medical',
    targetTab: 'offline_emergency',
    steps: [
      {
        id: 'offline_step_1',
        targetTourId: 'tour-offline-call-btn',
        title: 'Bước 1: Gọi Cấp cứu 24/7 Tuyến Trên',
        instruction: 'Thử chạm vào thẻ Cấp cứu để xem số điện thoại và bệnh viện tuyến trên phụ trách.',
        actionType: 'click',
        position: 'bottom',
      },
      {
        id: 'offline_step_2',
        targetTourId: 'tour-offline-sync-btn',
        title: 'Bước 2: Lưu dữ liệu ngoại tuyến',
        instruction: 'Thử bấm nút "Đồng bộ ngoại tuyến" để đảm bảo danh bạ được lưu sẵn vào bộ nhớ thiết bị.',
        actionType: 'click',
        position: 'top',
      },
    ],
  },
];

interface UserGuideContextType {
  activeTour: UserGuideTopic | null;
  currentStepIndex: number;
  currentStep: TourStep | null;
  isTourActive: boolean;
  startTour: (topicId: string, navigateCallback?: (tab: string) => void) => void;
  nextStep: () => void;
  prevStep: () => void;
  stopTour: () => void;
  navigateTabFn?: (tab: string) => void;
  setNavigateTabFn: (fn: (tab: string) => void) => void;
}

const UserGuideContext = createContext<UserGuideContextType | undefined>(undefined);

export const UserGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTour, setActiveTour] = useState<UserGuideTopic | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [navigateTabFn, setNavigateTabFn] = useState<((tab: string) => void) | undefined>(undefined);

  const startTour = useCallback(
    (topicId: string, customNavigate?: (tab: string) => void) => {
      const topic = USER_GUIDE_TOPICS.find(t => t.id === topicId);
      if (!topic || topic.steps.length === 0) return;

      const nav = customNavigate || navigateTabFn;
      if (nav && topic.targetTab) {
        nav(topic.targetTab);
      }

      setActiveTour(topic);
      setCurrentStepIndex(0);
      setIsTourActive(true);
    },
    [navigateTabFn]
  );

  const nextStep = useCallback(() => {
    if (!activeTour) return;
    if (currentStepIndex < activeTour.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Completed all steps
      setIsTourActive(false);
      setActiveTour(null);
      setCurrentStepIndex(0);
    }
  }, [activeTour, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const stopTour = useCallback(() => {
    setIsTourActive(false);
    setActiveTour(null);
    setCurrentStepIndex(0);
  }, []);

  const currentStep = activeTour && activeTour.steps[currentStepIndex] ? activeTour.steps[currentStepIndex] : null;

  return (
    <UserGuideContext.Provider
      value={{
        activeTour,
        currentStepIndex,
        currentStep,
        isTourActive,
        startTour,
        nextStep,
        prevStep,
        stopTour,
        navigateTabFn,
        setNavigateTabFn,
      }}
    >
      {children}
    </UserGuideContext.Provider>
  );
};

export const useUserGuide = () => {
  const context = useContext(UserGuideContext);
  if (!context) {
    throw new Error('useUserGuide must be used within a UserGuideProvider');
  }
  return context;
};
