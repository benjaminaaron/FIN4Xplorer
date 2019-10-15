import React, { useState, useEffect, useRef } from 'react';
import Box from '../components/Box';
import { drizzleConnect } from 'drizzle-react';
import { useTranslation } from 'react-i18next';
import Container from '../components/Container';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Cookies from 'js-cookie';

const useStyles = makeStyles(theme => ({
	font: {
		'font-family': 'arial'
	},
	lngLink: {
		'text-decoration': 'none'
	},
	activeLng: {
		'font-weight': 'bold'
	}
}));

function Settings(props, context) {
	const { t, i18n } = useTranslation();

	const classes = useStyles();

	const langIsEN = () => {
		return i18n.language === 'en';
	};

	return (
		<Container>
			<Box title="Settings">
				<div className={classes.font}>
					Language:{' '}
					<a
						className={`${classes.lngLink} ${langIsEN() ? classes.activeLng : ''}`}
						href="#"
						onClick={() => {
							let lng = i18n.language;
							i18n.changeLanguage('en', () => {
								console.log('Language changed: from ' + lng + ' to en');
								Cookies.set('language', 'en', { expires: 7 });
								// TODO is 7 a good expiry date for cookies? #ConceptualDecision
							});
						}}>
						EN
					</a>
					{' / '}
					<a
						className={`${classes.lngLink} ${!langIsEN() ? classes.activeLng : ''}`}
						href="#"
						onClick={() => {
							let lng = i18n.language;
							i18n.changeLanguage('de', () => {
								console.log('Language changed: from ' + lng + ' to de');
								Cookies.set('language', 'de', { expires: 7 });
							});
						}}>
						DE
					</a>
				</div>
			</Box>
		</Container>
	);
}

Settings.contextTypes = {
	drizzle: PropTypes.object
};

export default drizzleConnect(Settings);