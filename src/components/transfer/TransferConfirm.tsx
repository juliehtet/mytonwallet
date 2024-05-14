import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import {
  ANIMATED_STICKER_SMALL_SIZE_PX, BURN_ADDRESS, BURN_CHUNK_DURATION_APPROX_SEC, NFT_BATCH_SIZE, TON_SYMBOL,
} from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { toDecimal } from '../../util/decimals';
import { formatCurrencySimple } from '../../util/formatNumber';
import { NFT_TRANSFER_TON_AMOUNT } from '../../api/blockchains/ton/constants';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import IconWithTooltip from '../ui/IconWithTooltip';
import InteractiveTextField from '../ui/InteractiveTextField';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import NftChips from './NftChips';
import NftInfo from './NftInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

import scamImg from '../../assets/scam.svg';

interface OwnProps {
  isActive: boolean;
  savedAddresses?: Record<string, string>;
  symbol: string;
  decimals?: number;
  onBack: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  currentTransfer: GlobalState['currentTransfer'];
}

function TransferConfirm({
  currentTransfer: {
    amount,
    toAddress,
    resolvedAddress,
    fee,
    comment,
    shouldEncrypt,
    promiseId,
    isLoading,
    toAddressName,
    isToNewAddress,
    isScam,
    binPayload,
    nfts,
  },
  symbol,
  decimals,
  isActive,
  savedAddresses,
  onBack,
  onClose,
}: OwnProps & StateProps) {
  const { submitTransferConfirm } = getActions();

  const lang = useLang();

  const addressName = savedAddresses?.[toAddress!] || toAddressName;
  const isNftTransfer = Boolean(nfts?.length);
  const isBurning = resolvedAddress === BURN_ADDRESS;

  useHistoryBack({
    isActive,
    onBack,
  });

  const handleConfirm = useLastCallback(() => {
    vibrate();
    submitTransferConfirm();
  });

  function renderNfts() {
    if (nfts!.length === 1) {
      return <NftInfo nft={nfts![0]} />;
    }

    return <NftChips nfts={nfts!} />;
  }

  function renderFeeForNft() {
    const totalFee = (NFT_TRANSFER_TON_AMOUNT + (fee ?? 0n)) * BigInt(Math.ceil(nfts!.length / NFT_BATCH_SIZE));

    return (
      <>
        <div className={styles.label}>{lang('Fee')}</div>
        <div className={styles.inputReadOnly}>
          ≈ {formatCurrencySimple(totalFee, '')}
          <span className={styles.currencySymbol}>{TON_SYMBOL}</span>
        </div>
      </>
    );
  }

  function renderComment() {
    if (binPayload) {
      return (
        <>
          <div className={styles.label}>{lang('Data to sign')}</div>
          <InteractiveTextField
            text={binPayload!}
            copyNotification={lang('Data was copied!')}
            className={styles.addressWidget}
          />

          <div className={styles.error}>
            {renderText(lang('$signature_warning'))}
          </div>
        </>
      );
    }

    if (!comment) {
      return undefined;
    }

    return (
      <>
        <div className={styles.label}>{shouldEncrypt ? lang('Encrypted Message') : lang('Comment or Memo')}</div>
        <div className={buildClassName(styles.inputReadOnly, styles.inputReadOnly_words, styles.commentInputWrapper)}>
          {comment}
        </div>
      </>
    );
  }

  const burningDurationMin = nfts?.length
    ? (Math.ceil(nfts.length / NFT_BATCH_SIZE) * BURN_CHUNK_DURATION_APPROX_SEC) / 60
    : undefined;

  return (
    <>
      <ModalHeader title={lang('Is it all ok?')} onClose={onClose} />
      <div className={modalStyles.transitionContent}>
        {isNftTransfer ? renderNfts() : (
          <AnimatedIconWithPreview
            size={ANIMATED_STICKER_SMALL_SIZE_PX}
            play={isActive}
            noLoop={false}
            nonInteractive
            className={buildClassName(styles.sticker, styles.sticker_sizeSmall)}
            tgsUrl={ANIMATED_STICKERS_PATHS.bill}
            previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
          />
        )}
        <div className={styles.label}>
          {lang('Receiving Address')}
          <Transition name="fade" activeKey={isScam ? 0 : 1} className={styles.scamContainer}>
            {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
          </Transition>

          {isToNewAddress && (
            <IconWithTooltip
              emoji="⚠️"
              message={lang('This address is new and never received transfers before.')}
              tooltipClassName={styles.warningTooltipContainer}
            />
          )}
        </div>
        <InteractiveTextField
          address={resolvedAddress!}
          addressName={addressName}
          copyNotification={lang('Address was copied!')}
          className={styles.addressWidget}
          textClassName={isScam ? styles.scamAddress : undefined}
        />

        {isNftTransfer ? renderFeeForNft() : (
          <AmountWithFeeTextField
            label={lang('Amount')}
            amount={toDecimal(amount ?? 0n, decimals)}
            symbol={symbol}
            fee={fee ? toDecimal(fee) : undefined}
          />
        )}

        {renderComment()}

        {isBurning && nfts && (
          <div className={styles.burnWarning}>
            {(
              nfts?.length === 1
                ? renderText(lang('Are you sure you want to burn this NFT? It will be lost forever.'))
                : [
                  renderText(lang('$multi_burn_nft_warning', { amount: nfts.length })),
                  ' ',
                  renderText(lang('$multi_send_nft_warning', { duration: burningDurationMin })),
                ]
            )}
          </div>
        )}

        <div className={buildClassName(modalStyles.buttons, modalStyles.buttonsInsideContentWithScroll)}>
          {promiseId ? (
            <Button onClick={onClose} className={modalStyles.button}>{lang('Cancel')}</Button>
          ) : (
            <Button onClick={onBack} className={modalStyles.button}>{lang('Edit')}</Button>
          )}
          <Button
            isPrimary
            isLoading={isLoading}
            isDestructive={isBurning}
            className={modalStyles.button}
            onClick={handleConfirm}
          >
            {lang(isBurning ? 'Burn NFT' : 'Confirm')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    currentTransfer: global.currentTransfer,
  };
})(TransferConfirm));
