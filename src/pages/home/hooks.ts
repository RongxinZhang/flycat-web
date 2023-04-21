import { Dispatch, SetStateAction, useEffect } from 'react';
import { CallRelayType } from 'service/worker/type';
import { Event, PublicKey, WellKnownEventKind } from 'service/api';
import { EventWithSeen } from 'pages/type';
import { CallWorker } from 'service/worker/callWorker';
import { handleEvent } from './utils';
import { UserMap } from 'service/type';

export function useSubMetaDataAndContactList(
  myPublicKey,
  newConn,
  isLoggedIn,
  worker,
  handleEvent,
) {
  useEffect(() => {
    if (isLoggedIn !== true) return;
    if (!myPublicKey || myPublicKey.length === 0) return;

    const callRelay =
      newConn.length === 0
        ? { type: CallRelayType.all, data: [] }
        : { type: CallRelayType.batch, data: newConn };
    const sub = worker?.subMetaDataAndContactList(
      [myPublicKey],
      false,
      'userMetaAndContact',
      callRelay,
    );
    sub?.iterating({
      cb: handleEvent,
    });
  }, [myPublicKey, newConn]);
}

export function useSubMsg(
  myContactList,
  myPublicKey,
  newConn,
  worker,
  handleEvent,
) {
  useEffect(() => {
    const pks = myContactList?.keys || [];
    // subscribe myself msg too
    if (myPublicKey && !pks.includes(myPublicKey) && myPublicKey.length > 0)
      pks.push(myPublicKey);

    if (pks.length > 0 && newConn.length > 0) {
      const callRelay = {
        type: CallRelayType.batch,
        data: newConn,
      };
      const subMetadata = worker?.subMetadata(
        pks,
        false,
        'homeMetadata',
        callRelay,
      );
      subMetadata?.iterating({
        cb: handleEvent,
      });

      const subMsg = worker?.subMsg(pks, false, 'homeMsg', callRelay);
      subMsg?.iterating({
        cb: handleEvent,
      });
    }
  }, [myContactList?.created_at, newConn]);
}

export function useSubGlobalMsg(isLoggedIn, newConn, worker, handleEvent) {
  useEffect(() => {
    if (isLoggedIn) return;
    if (newConn.length === 0) return;

    const sub = worker?.subFilter(
      {
        kinds: [WellKnownEventKind.text_note],
        limit: 50,
      },
      undefined,
      undefined,
      {
        type: CallRelayType.batch,
        data: newConn,
      },
    );

    sub?.iterating({
      cb: handleEvent,
    });
  }, [isLoggedIn, newConn]);
}

export function useLoadMoreMsg({
  isLoggedIn,
  myContactList,
  myPublicKey,
  msgList,
  worker,
  userMap,
  setUserMap,
  setMsgList,
  setGlobalMsgList,
  setMyContactList,
  loadMoreCount,
}: {
  isLoggedIn: boolean;
  myContactList?: { keys: PublicKey[]; created_at: number };
  setMyContactList: Dispatch<
    SetStateAction<
      | {
          keys: PublicKey[];
          created_at: number;
        }
      | undefined
    >
  >;
  myPublicKey: string;
  msgList: EventWithSeen[];
  worker?: CallWorker;
  userMap: UserMap;
  setUserMap: Dispatch<SetStateAction<UserMap>>;
  setGlobalMsgList: Dispatch<SetStateAction<Event[]>>;
  setMsgList: Dispatch<SetStateAction<Event[]>>;
  loadMoreCount: number;
}) {
  useEffect(() => {
    const pks = myContactList?.keys || [];
    // subscribe myself msg too
    if (myPublicKey && !pks.includes(myPublicKey) && myPublicKey.length > 0)
      pks.push(myPublicKey);

    if (pks.length > 0) {
      const lastMsg = msgList.at(msgList.length - 1);
      if (!lastMsg) {
        return;
      }

      const callRelay = {
        type: CallRelayType.connected,
        data: [],
      };

      const subMsg = worker?.subMsg(pks, false, 'homeMoreMsg', callRelay, {
        until: lastMsg.created_at,
      });
      subMsg?.iterating({
        cb: handleEvent(
          worker,
          isLoggedIn,
          userMap,
          myPublicKey,
          setUserMap,
          setGlobalMsgList,
          setMsgList,
          setMyContactList,
          50 * loadMoreCount,
        ),
      });
    }
  }, [loadMoreCount]);
}
