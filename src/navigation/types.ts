import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Explore: undefined;
  Portfolio: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  SignIn: undefined;
  Terms: undefined;
  CompleteProfile: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  /** `side` opens the Invest/Redeem panel on that tab. */
  Basket: { id: string; side?: 'invest' | 'redeem' };
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
